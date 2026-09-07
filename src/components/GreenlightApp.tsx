"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { GreenlightPackage, ProgressEvent, StageName, ToolCall } from "@/lib/types";
import { ReelPlayer } from "./ReelPlayer";

const EXAMPLES = [
  "A washed-up Bollywood stunt double is hired to fake a billionaire's death for an insurance scam — and discovers the man is already dead.",
  "A deaf marine biologist discovers whales are singing a warning about an undersea volcano, and must convince a skeptical Navy before the coast is lost.",
  "In 1950s Lagos, a highlife singer moonlights as a courier for the independence movement while a British inspector falls in love with her voice.",
  "A grief-stricken game designer rebuilds her late brother inside an AI companion — then the companion starts remembering things she never told it.",
  "A cozy mystery series: a retired Kerala spice trader solves murders in a Scottish fishing village with help from her sharp-tongued granddaughter.",
];

const STAGES: { key: StageName; label: string; who: string; blurb: string }[] = [
  { key: "scout", label: "Scout", who: "Gemini + Parallel Search", blurb: "Live web research on comps, market & audience" },
  { key: "analyst", label: "Analyst", who: "Gemini · structured output", blurb: "Comps, risks, budget band, verdict" },
  { key: "producer", label: "Producer", who: "Gemini · structured output", blurb: "Greenlight memo + poster art direction" },
  { key: "poster", label: "Poster", who: "Gemini image model", blurb: "Teaser key art for the reel" },
];

type StageState = "idle" | "running" | "done";
type Tab = "reel" | "memo" | "comps" | "research";

function decisionColor(d: string) {
  return d === "GREENLIGHT" ? "text-green" : d === "DEVELOP" ? "text-amber" : "text-red";
}
function decisionBorder(d: string) {
  return d === "GREENLIGHT" ? "border-green" : d === "DEVELOP" ? "border-amber" : "border-red";
}
const fmtM = (n: number | null) => (n == null ? "—" : n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${Math.round(n)}M`);

export function GreenlightApp() {
  const [logline, setLogline] = useState(EXAMPLES[0]);
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<StageName, StageState>>({ scout: "idle", analyst: "idle", producer: "idle", poster: "idle" });
  const [stageMs, setStageMs] = useState<Partial<Record<StageName, number>>>({});
  const [log, setLog] = useState<string[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [scoutText, setScoutText] = useState("");
  const [pkg, setPkg] = useState<GreenlightPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("reel");
  const [history, setHistory] = useState<GreenlightPackage[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("greenlight.history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log, scoutText]);

  const saveHistory = useCallback((p: GreenlightPackage) => {
    setHistory((h) => {
      const slim = { ...p, posterDataUrl: undefined, research: p.research.slice(0, 4000) };
      const next = [slim, ...h.filter((x) => x.id !== p.id)].slice(0, 8);
      try {
        localStorage.setItem("greenlight.history", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = () => {
    setStages({ scout: "idle", analyst: "idle", producer: "idle", poster: "idle" });
    setStageMs({});
    setLog([]);
    setToolCalls([]);
    setScoutText("");
    setPkg(null);
    setError(null);
    setTab("reel");
  };

  const handle = useCallback(
    (e: ProgressEvent) => {
      switch (e.type) {
        case "stage":
          setStages((s) => ({ ...s, [e.stage]: e.status === "start" ? "running" : "done" }));
          if (e.status === "done" && e.ms != null) setStageMs((m) => ({ ...m, [e.stage]: e.ms }));
          setLog((l) => [...l, e.status === "start" ? `▶ ${e.stage} started` : `✓ ${e.stage} done${e.ms ? ` · ${(e.ms / 1000).toFixed(1)}s` : ""}`]);
          break;
        case "tool":
          setToolCalls((t) => [...t, e.call]);
          setLog((l) => [...l, `⇄ Parallel Search · ${e.call.resultCount} results · ${e.call.durationMs}ms · "${e.call.queries.join('" / "')}"`]);
          break;
        case "note":
          setLog((l) => [...l, `· ${e.message}`]);
          break;
        case "text":
          setScoutText((t) => t + e.delta);
          break;
        case "result":
          setPkg(e.pkg);
          saveHistory(e.pkg);
          break;
        case "error":
          setError(e.message);
          break;
      }
    },
    [saveHistory],
  );

  const run = async () => {
    if (running) return;
    reset();
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/greenlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logline }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const c of chunks) {
          const line = c.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            handle(JSON.parse(line.slice(6)) as ProgressEvent);
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  const verdict = pkg?.analysis.verdict;
  const totalS = useMemo(() => (pkg ? (pkg.timingsMs.total / 1000).toFixed(0) : null), [pkg]);

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-8">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-gold shadow-[0_0_20px_rgba(232,176,75,0.8)]" />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Greenlight</h1>
          </div>
          <p className="text-muted mt-2 max-w-2xl">
            The studio development-exec agent. Type a logline → a Gemini agent team researches comps on the live web with
            Parallel, writes the greenlight memo, and renders a pitch reel.
          </p>
        </div>
        <div className="text-xs text-muted font-mono text-right leading-5">
          <div>Google ADK · Gemini · Parallel Search API</div>
          <div>Remotion pitch reel · Cloud Run</div>
        </div>
      </header>

      {/* input */}
      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Logline</label>
        <textarea
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
          rows={3}
          maxLength={600}
          disabled={running}
          className="mt-2 w-full resize-none rounded-xl bg-panel-2 border border-line p-4 text-lg leading-relaxed outline-none focus:border-gold/70 disabled:opacity-60"
          placeholder="A one-sentence pitch for a film or series…"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setLogline(ex)}
              disabled={running}
              className="text-xs px-3 py-1.5 rounded-full border border-line text-muted hover:text-foreground hover:border-gold/60 transition disabled:opacity-50"
              title={ex}
            >
              Example {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {!running ? (
            <button
              onClick={run}
              disabled={logline.trim().length < 15}
              className="px-6 py-3 rounded-xl bg-gold text-black font-semibold hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40"
            >
              Run the greenlight process
            </button>
          ) : (
            <button onClick={stop} className="px-6 py-3 rounded-xl border border-line hover:border-red text-foreground transition">
              Stop
            </button>
          )}
          <span className="text-sm text-muted">{running ? "Agents working — typically 60–120 seconds." : "≈ 90 seconds · 3 agents · 3–5 live web searches"}</span>
        </div>
      </section>

      {/* pipeline + console */}
      {(running || pkg || error || log.length > 0) && (
        <section className="grid lg:grid-cols-[1fr_1.4fr] gap-5">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-muted mb-4">Agent team</div>
            <ol className="flex flex-col gap-3">
              {STAGES.map((s, i) => {
                const st = stages[s.key];
                return (
                  <li key={s.key} className={`flex gap-4 rounded-xl border p-4 transition ${st === "running" ? "border-gold/70 bg-panel-2" : st === "done" ? "border-line bg-panel-2/60" : "border-line/60 opacity-60"}`}>
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${st === "done" ? "bg-green text-black" : st === "running" ? "bg-gold text-black pulse" : "bg-line text-muted"}`}
                      >
                        {st === "done" ? "✓" : i + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-semibold">{s.label}</div>
                        <div className="text-[11px] font-mono text-muted">{stageMs[s.key] != null ? `${(stageMs[s.key]! / 1000).toFixed(1)}s` : s.who}</div>
                      </div>
                      <div className="text-sm text-muted mt-0.5">{s.blurb}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {toolCalls.length > 0 && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-[0.2em] text-muted mb-2">Parallel Search calls · {toolCalls.length}</div>
                <ul className="flex flex-col gap-2">
                  {toolCalls.map((c, i) => (
                    <li key={i} className="text-sm rounded-lg border border-line bg-panel-2 p-3">
                      <div className="text-foreground/90">{c.objective}</div>
                      <div className="text-xs text-muted mt-1 font-mono">
                        {c.queries.join(" · ")} → {c.resultCount} results · {c.durationMs}ms
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col min-h-[320px]">
            <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Live console</div>
            <div ref={logRef} className="flex-1 overflow-auto max-h-[420px] font-mono text-[12.5px] leading-6 text-muted">
              {log.map((l, i) => (
                <div key={i} className={l.startsWith("✓") ? "text-green" : l.startsWith("▶") ? "text-gold" : l.startsWith("⇄") ? "text-foreground/80" : ""}>
                  {l}
                </div>
              ))}
              {scoutText && (
                <pre className="whitespace-pre-wrap text-foreground/70 mt-3 border-t border-line pt-3">{scoutText}</pre>
              )}
              {error && <div className="text-red mt-3">✗ {error}</div>}
              {running && <div className="pulse mt-2">▍</div>}
            </div>
          </div>
        </section>
      )}

      {/* results */}
      {pkg && verdict && (
        <section className="flex flex-col gap-5">
          <div className={`rounded-2xl border-2 ${decisionBorder(verdict.decision)} bg-panel p-6 flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Studio verdict</div>
              <div className={`text-5xl font-black tracking-wide mt-1 ${decisionColor(verdict.decision)}`}>{verdict.decision}</div>
              <div className="text-lg mt-2 max-w-3xl">{verdict.headline}</div>
            </div>
            <div className="text-right text-sm text-muted font-mono leading-6">
              <div>confidence {verdict.confidence}%</div>
              <div>{pkg.toolCalls.length} Parallel searches · {pkg.sources.length} sources</div>
              <div>{pkg.models.text}{pkg.models.image ? ` · ${pkg.models.image}` : ""}</div>
              <div>{totalS}s end to end</div>
            </div>
          </div>

          <div className="flex gap-2 border-b border-line">
            {(["reel", "memo", "comps", "research"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition ${tab === t ? "border-gold text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
              >
                {t === "reel" ? "Pitch reel" : t === "memo" ? "Greenlight memo" : t === "comps" ? "Comps & market" : "Research & sources"}
              </button>
            ))}
          </div>

          {tab === "reel" && (
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
              <ReelPlayer logline={pkg.logline} analysis={pkg.analysis} posterDataUrl={pkg.posterDataUrl} autoPlay />
              <div className="rounded-2xl border border-line bg-panel p-5 text-sm leading-6">
                <div className="text-xs uppercase tracking-[0.2em] text-muted mb-2">About this reel</div>
                <p className="text-muted">
                  Rendered live in the browser with Remotion from the agent&apos;s JSON output: title card, logline, comps chart, market stats,
                  risk register, budget band and verdict. Scrub, pause, or loop it.
                </p>
                {pkg.posterDataUrl && (
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted mb-2">Poster key art · {pkg.models.image}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pkg.posterDataUrl} alt="Generated teaser poster" className="rounded-xl border border-line w-full" />
                    <p className="text-xs text-muted mt-2 italic">{pkg.posterPrompt}</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ ...pkg, posterDataUrl: undefined }, null, 2))}`}
                    download={`greenlight-${pkg.analysis.title.toLowerCase().replace(/\W+/g, "-")}.json`}
                    className="text-xs px-3 py-1.5 rounded-full border border-line text-muted hover:text-foreground hover:border-gold/60"
                  >
                    Download package JSON
                  </a>
                  <a
                    href={`/api/render?id=${pkg.id}`}
                    onClick={(e) => e.preventDefault()}
                    className="text-xs px-3 py-1.5 rounded-full border border-line text-muted/50 cursor-default"
                    title="MP4 export via the Remotion CLI: npm run render"
                  >
                    MP4 export: `npm run render`
                  </a>
                </div>
              </div>
            </div>
          )}

          {tab === "memo" && (
            <article className="memo rounded-2xl border border-line bg-panel p-6 sm:p-8 max-w-4xl">
              <ReactMarkdown>{pkg.memo}</ReactMarkdown>
            </article>
          )}

          {tab === "comps" && (
            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
              <div className="rounded-2xl border border-line bg-panel p-5 overflow-x-auto">
                <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Comparable titles</div>
                <table className="w-full text-sm">
                  <thead className="text-muted text-left">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Title</th>
                      <th className="py-2 pr-3 font-medium">Budget</th>
                      <th className="py-2 pr-3 font-medium">Worldwide</th>
                      <th className="py-2 pr-3 font-medium">Platform</th>
                      <th className="py-2 pr-3 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.analysis.comps.map((c) => (
                      <tr key={c.title} className="border-t border-line align-top">
                        <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">
                          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-gold">
                            {c.title}
                          </a>{" "}
                          <span className="text-muted font-normal">{c.year}</span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{fmtM(c.budgetUsdM)}</td>
                        <td className="py-2.5 pr-3 font-mono">{fmtM(c.worldwideGrossUsdM)}</td>
                        <td className="py-2.5 pr-3 text-muted">{c.platform}</td>
                        <td className="py-2.5 pr-3 text-muted">{c.whyComparable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-5">
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Market</div>
                  <div className="font-semibold">{pkg.analysis.market.trend}</div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {pkg.analysis.market.keyStats.map((s) => (
                      <div key={s.label} className="rounded-lg bg-panel-2 border border-line p-3">
                        <div className="text-xl font-extrabold text-gold">{s.value}</div>
                        <div className="text-[11px] text-muted mt-1 leading-4">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-muted mt-3">
                    <span className="text-foreground">Audience:</span> {pkg.analysis.market.audience}
                  </div>
                  <div className="text-sm text-muted mt-1">
                    <span className="text-foreground">Timing:</span> {pkg.analysis.market.timing}
                  </div>
                </div>
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Budget band</div>
                  <div className="text-3xl font-extrabold text-gold">{fmtM(pkg.analysis.budget.recommendedUsdM)}</div>
                  <div className="text-sm text-muted">
                    band {fmtM(pkg.analysis.budget.lowUsdM)} – {fmtM(pkg.analysis.budget.highUsdM)}
                  </div>
                  <div className="text-sm text-muted mt-2">{pkg.analysis.budget.rationale}</div>
                </div>
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Risks</div>
                  <ul className="flex flex-col gap-2 text-sm">
                    {pkg.analysis.risks.map((r) => (
                      <li key={r.risk} className="flex gap-3">
                        <span className={`text-[10px] uppercase tracking-wider mt-1 w-14 shrink-0 ${r.severity === "high" ? "text-red" : r.severity === "medium" ? "text-amber" : "text-green"}`}>
                          {r.severity}
                        </span>
                        <span>
                          <span className="font-medium">{r.risk}</span> <span className="text-muted">— {r.mitigation}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "research" && (
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
              <article className="memo rounded-2xl border border-line bg-panel p-6 text-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Scout research notes</div>
                <ReactMarkdown>{pkg.research}</ReactMarkdown>
              </article>
              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Sources · {pkg.sources.length} via Parallel</div>
                <ul className="flex flex-col gap-2 text-sm">
                  {pkg.sources.map((s) => (
                    <li key={s.url} className="truncate">
                      <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-gold">
                        {s.title || s.url}
                      </a>
                      <div className="text-[11px] text-muted truncate">{s.url}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {/* history */}
      {history.length > 0 && !running && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Recent packages (this browser)</div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => {
                    setPkg(h);
                    setTab("reel");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full text-left rounded-xl border border-line bg-panel-2 p-3 hover:border-gold/60 transition"
                >
                  <div className={`text-xs font-bold ${decisionColor(h.analysis.verdict.decision)}`}>{h.analysis.verdict.decision}</div>
                  <div className="font-semibold mt-0.5">{h.analysis.title}</div>
                  <div className="text-xs text-muted mt-1 line-clamp-2">{h.logline}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="text-xs text-muted text-center py-6">
        Built for Agentic Cinema (Parallel track). Product AI: Gemini via Google ADK + Google GenAI SDK. Research: Parallel Search API. Video: Remotion.
      </footer>
    </main>
  );
}
