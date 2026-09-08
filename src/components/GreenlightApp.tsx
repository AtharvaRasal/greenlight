"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Decision, GreenlightPackage, ProgressEvent, StageName, ToolCall } from "@/lib/types";
import { ReelPlayer } from "./ReelPlayer";
import { GuideDrawer } from "./GuideDrawer";

const EXAMPLES: { name: string; text: string }[] = [
  {
    name: "Bollywood stunt heist",
    text: "A washed-up Bollywood stunt double is hired to fake a billionaire's death for an insurance scam — and discovers the man is already dead.",
  },
  {
    name: "Whale warning",
    text: "A deaf marine biologist discovers whales are singing a warning about an undersea volcano, and must convince a skeptical Navy before the coast is lost.",
  },
  {
    name: "1950s Lagos",
    text: "In 1950s Lagos, a highlife singer moonlights as a courier for the independence movement while a British inspector falls in love with her voice.",
  },
  {
    name: "AI brother",
    text: "A grief-stricken game designer rebuilds her late brother inside an AI companion — then the companion starts remembering things she never told it.",
  },
  {
    name: "Cozy mystery series",
    text: "A cozy mystery series: a retired Kerala spice trader solves murders in a Scottish fishing village with help from her sharp-tongued granddaughter.",
  },
];

// Plain-language labels for the four pipeline stages.
const STAGES: { key: StageName; label: string; doing: string; done: string }[] = [
  { key: "scout", label: "Researcher", doing: "Searching the live web for similar films, their budgets and earnings", done: "Found comparable films and market facts" },
  { key: "analyst", label: "Analyst", doing: "Comparing the numbers, weighing the risks, setting a budget range", done: "Verdict, risks and budget decided" },
  { key: "producer", label: "Writer", doing: "Writing the studio memo and describing the poster", done: "Memo written" },
  { key: "poster", label: "Poster artist", doing: "Painting the key art for your pitch video", done: "Poster ready" },
];

const DECISION_MEANING: Record<Decision, string> = {
  GREENLIGHT: "Strong case. The comparable films and the market support making this.",
  DEVELOP: "Promising, but it needs work before a studio would commit money.",
  PASS: "The comparable films and the market argue against making this now.",
};

type StageState = "idle" | "running" | "done";
type Tab = "video" | "memo" | "numbers" | "sources";

const decisionColor = (d: Decision) => (d === "GREENLIGHT" ? "text-green" : d === "DEVELOP" ? "text-amber" : "text-red");
const decisionBorder = (d: Decision) => (d === "GREENLIGHT" ? "border-green" : d === "DEVELOP" ? "border-amber" : "border-red");
const decisionBg = (d: Decision) => (d === "GREENLIGHT" ? "bg-green" : d === "DEVELOP" ? "bg-amber" : "bg-red");
const fmtM = (n: number | null) => (n == null ? "—" : n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${Math.round(n)}M`);
const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "");

export function GreenlightApp() {
  const [logline, setLogline] = useState(EXAMPLES[0].text);
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<StageName, StageState>>({ scout: "idle", analyst: "idle", producer: "idle", poster: "idle" });
  const [feed, setFeed] = useState<string[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [scoutText, setScoutText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [pkg, setPkg] = useState<GreenlightPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("video");
  const [history, setHistory] = useState<GreenlightPackage[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [render, setRender] = useState<{ state: "idle" | "working" | "done" | "error"; url?: string; message?: string }>({ state: "idle" });
  const feedRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("greenlight.history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [feed]);

  useEffect(() => {
    if (pkg) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [pkg]);

  const saveHistory = useCallback((p: GreenlightPackage) => {
    setHistory((h) => {
      const slim = { ...p, posterDataUrl: undefined, research: p.research.slice(0, 4000) };
      const next = [slim, ...h.filter((x) => x.id !== p.id)].slice(0, 6);
      try {
        localStorage.setItem("greenlight.history", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = () => {
    setStages({ scout: "idle", analyst: "idle", producer: "idle", poster: "idle" });
    setFeed([]);
    setToolCalls([]);
    setScoutText("");
    setShowNotes(false);
    setPkg(null);
    setError(null);
    setTab("video");
    setRender({ state: "idle" });
  };

  const handle = useCallback(
    (e: ProgressEvent) => {
      switch (e.type) {
        case "stage": {
          const s = STAGES.find((x) => x.key === e.stage)!;
          setStages((st) => ({ ...st, [e.stage]: e.status === "start" ? "running" : "done" }));
          setFeed((l) => [...l, e.status === "start" ? `${s.label}: ${s.doing}…` : `✓ ${s.done}${e.ms ? ` (${(e.ms / 1000).toFixed(0)}s)` : ""}`]);
          break;
        }
        case "tool":
          setToolCalls((t) => [...t, e.call]);
          setFeed((l) => [...l, `Searched the web: ${e.call.objective} → ${e.call.resultCount} sources in ${(e.call.durationMs / 1000).toFixed(1)}s`]);
          break;
        case "note":
          if (e.message.startsWith("poster skipped")) setFeed((l) => [...l, "Poster skipped this time (the image model declined). Your video will use a dark background instead."]);
          else if (e.message.startsWith("parallel_search error")) setFeed((l) => [...l, "One web search failed and is being retried."]);
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
    setTimeout(() => progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
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

  const downloadMp4 = async () => {
    if (!pkg || render.state === "working") return;
    setRender({ state: "working" });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logline: pkg.logline, analysis: pkg.analysis, posterDataUrl: pkg.posterDataUrl }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setRender({ state: "done", url });
      const a = document.createElement("a");
      a.href = url;
      a.download = `greenlight-${slug(pkg.analysis.title)}-pitch-reel.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setRender({ state: "error", message: (e as Error).message });
    }
  };

  const verdict = pkg?.analysis.verdict;
  const totalS = useMemo(() => (pkg ? Math.round(pkg.timingsMs.total / 1000) : null), [pkg]);
  const memoHref = useMemo(() => (pkg ? `data:text/markdown;charset=utf-8,${encodeURIComponent(pkg.memo)}` : "#"), [pkg]);
  const started = running || !!pkg || feed.length > 0;

  return (
    <main className="flex-1 w-full">
      <GuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* top bar */}
      <div className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gold shadow-[0_0_16px_rgba(232,176,75,0.9)]" />
            <span className="font-extrabold tracking-tight text-lg">Greenlight</span>
            <span className="hidden sm:inline text-sm text-muted">· the studio decision, in 90 seconds</span>
          </div>
          <button
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-line hover:border-gold/70 hover:text-gold transition"
            aria-label="How to use Greenlight"
          >
            <span className="inline-flex w-5 h-5 items-center justify-center rounded-full border border-current text-[11px] font-bold">?</span>
            How it works
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col gap-10">
        {/* hero */}
        {!started && (
          <header className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Pitch a film in one sentence.
              <br />
              <span className="text-gold">Get a studio decision in 90 seconds.</span>
            </h1>
            <p className="text-muted mt-5 text-lg leading-relaxed">
              Greenlight reads your idea, researches similar films on the live web, and hands you a clear verdict, a one-page
              memo, and a 30-second pitch video you can download.
            </p>
            <ol className="mt-8 grid sm:grid-cols-3 gap-3 text-left">
              {[
                ["1", "Write your idea", "One sentence is enough. Or pick an example below."],
                ["2", "Watch the team work", "Four AI specialists research, judge, write and paint. Every web search is shown live."],
                ["3", "Get your decision", "Greenlight, Develop or Pass, with the numbers, the memo and the video."],
              ].map(([n, t, d]) => (
                <li key={n} className="rounded-2xl border border-line bg-panel p-4 flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-gold text-black text-sm font-bold inline-flex items-center justify-center">{n}</span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="text-sm text-muted mt-0.5">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </header>
        )}

        {/* input */}
        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <label htmlFor="logline" className="font-semibold">
              Your one-sentence pitch
            </label>
            <span className="text-xs text-muted">In the film business this is called a logline.</span>
          </div>
          <textarea
            id="logline"
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            rows={3}
            maxLength={600}
            disabled={running}
            className="mt-3 w-full resize-none rounded-xl bg-panel-2 border border-line p-4 text-lg leading-relaxed outline-none focus:border-gold/70 disabled:opacity-60"
            placeholder="A retired thief must steal back her own stolen heart… (who, what they want, what stands in the way)"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted mr-1">Try an example:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                onClick={() => setLogline(ex.text)}
                disabled={running}
                className={`text-xs px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${logline === ex.text ? "border-gold text-gold" : "border-line text-muted hover:text-foreground hover:border-gold/60"}`}
                title={ex.text}
              >
                {ex.name}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            {!running ? (
              <button
                onClick={run}
                disabled={logline.trim().length < 15}
                className="px-7 py-3.5 rounded-xl bg-gold text-black text-lg font-semibold hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40"
              >
                {pkg ? "Run another pitch" : "Get my verdict"}
              </button>
            ) : (
              <button onClick={stop} className="px-6 py-3 rounded-xl border border-line hover:border-red transition">
                Stop
              </button>
            )}
            <span className="text-sm text-muted">
              {running ? "Working… this usually takes 60 to 120 seconds. Watch the team below." : "Takes about 90 seconds. Nothing to install, nothing to sign up for."}
            </span>
          </div>
        </section>

        {/* progress */}
        {started && (
          <section ref={progressRef} className="flex flex-col gap-4 scroll-mt-20">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h2 className="text-2xl font-bold">{running ? "The team is working on your pitch" : pkg ? "How your verdict was made" : "Stopped"}</h2>
              {pkg && (
                <span className="text-sm text-muted">
                  {pkg.toolCalls.length} web searches · {pkg.sources.length} sources checked · {totalS}s
                </span>
              )}
            </div>
            <div className="grid lg:grid-cols-[1fr_1.35fr] gap-5">
              <ol className="flex flex-col gap-3">
                {STAGES.map((s, i) => {
                  const st = stages[s.key];
                  return (
                    <li
                      key={s.key}
                      className={`flex gap-4 rounded-2xl border p-4 transition ${st === "running" ? "border-gold/70 bg-panel-2" : st === "done" ? "border-line bg-panel" : "border-line/60 bg-panel opacity-50"}`}
                    >
                      <span
                        className={`mt-0.5 shrink-0 inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${st === "done" ? "bg-green text-black" : st === "running" ? "bg-gold text-black pulse" : "bg-line text-muted"}`}
                      >
                        {st === "done" ? "✓" : i + 1}
                      </span>
                      <div>
                        <div className="font-semibold">{s.label}</div>
                        <div className="text-sm text-muted mt-0.5">{st === "done" ? s.done : st === "running" ? `${s.doing}…` : s.doing}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col">
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">Live feed</div>
                  <div className="text-xs text-muted">Every web search is real and shown as it happens</div>
                </div>
                <div ref={feedRef} className="mt-3 flex-1 overflow-auto max-h-[360px] text-[13.5px] leading-6 text-muted flex flex-col gap-1">
                  {feed.map((l, i) => (
                    <div key={i} className={l.startsWith("✓") ? "text-green" : l.startsWith("Searched") ? "text-foreground/85" : ""}>
                      {l}
                    </div>
                  ))}
                  {running && <div className="pulse text-gold">▍</div>}
                  {error && <div className="text-red mt-2">Something went wrong: {error}</div>}
                </div>
                {scoutText && (
                  <div className="mt-3 border-t border-line pt-3">
                    <button onClick={() => setShowNotes((v) => !v)} className="text-xs text-muted hover:text-gold">
                      {showNotes ? "Hide" : "Show"} the researcher&apos;s raw notes
                    </button>
                    {showNotes && <pre className="whitespace-pre-wrap text-xs text-foreground/70 mt-2 max-h-72 overflow-auto">{scoutText}</pre>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* result */}
        {pkg && verdict && (
          <section ref={resultRef} className="flex flex-col gap-6 scroll-mt-20">
            <div className={`rounded-2xl border-2 ${decisionBorder(verdict.decision)} bg-panel p-6 sm:p-8`}>
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Your verdict</div>
              <div className="flex flex-wrap items-end justify-between gap-6 mt-2">
                <div className="max-w-3xl">
                  <div className={`text-5xl sm:text-6xl font-black tracking-wide ${decisionColor(verdict.decision)}`}>{verdict.decision}</div>
                  <p className="text-lg mt-3">{DECISION_MEANING[verdict.decision]}</p>
                  <p className="text-muted mt-2">{verdict.headline}</p>
                </div>
                <div className="min-w-[220px]">
                  <div className="flex justify-between text-sm text-muted">
                    <span>How sure the team is</span>
                    <span className="font-semibold text-foreground">{verdict.confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-line mt-2 overflow-hidden">
                    <div className={`h-full ${decisionBg(verdict.decision)}`} style={{ width: `${verdict.confidence}%` }} />
                  </div>
                  <div className="text-xs text-muted mt-3 leading-5">
                    Working title <span className="text-foreground font-semibold">{pkg.analysis.title}</span>
                    <br />
                    Suggested budget <span className="text-foreground font-semibold">{fmtM(pkg.analysis.budget.recommendedUsdM)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-muted mb-2">Now explore what the team made for you:</div>
              <div className="flex gap-1 border-b border-line overflow-x-auto">
                {(
                  [
                    ["video", "Watch the pitch video"],
                    ["memo", "Read the studio memo"],
                    ["numbers", "See the numbers & risks"],
                    ["sources", "Check the sources"],
                  ] as [Tab, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition ${tab === t ? "border-gold text-foreground font-semibold" : "border-transparent text-muted hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "video" && (
              <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
                <ReelPlayer logline={pkg.logline} analysis={pkg.analysis} posterDataUrl={pkg.posterDataUrl} autoPlay />
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-line bg-panel p-5 text-sm leading-6">
                    <div className="font-semibold mb-1">Your 30-second pitch video</div>
                    <p className="text-muted">
                      Built from the team&apos;s findings: title over the poster, your pitch, a chart of comparable films, market numbers, risks, budget and
                      the verdict. Press play, or download it to send to someone.
                    </p>
                    <button
                      onClick={downloadMp4}
                      disabled={render.state === "working"}
                      className="mt-4 w-full px-5 py-3 rounded-xl bg-gold text-black font-semibold hover:brightness-110 transition disabled:opacity-60"
                    >
                      {render.state === "working" ? "Rendering your video… usually 1 to 3 minutes" : render.state === "done" ? "Download again (MP4)" : "Download as MP4"}
                    </button>
                    {render.state === "working" && (
                      <div className="h-1.5 rounded-full bg-line mt-3 overflow-hidden">
                        <div className="h-full w-1/3 bg-gold animate-[slide_1.4s_ease-in-out_infinite]" />
                      </div>
                    )}
                    {render.state === "error" && <div className="text-red text-xs mt-2">Couldn&apos;t render: {render.message}</div>}
                    {render.state === "done" && render.url && (
                      <a href={render.url} download className="block text-xs text-muted mt-2 hover:text-gold">
                        If the download didn&apos;t start, click here.
                      </a>
                    )}
                  </div>
                  {pkg.posterDataUrl && (
                    <div className="rounded-2xl border border-line bg-panel p-5">
                      <div className="font-semibold mb-2 text-sm">The poster the team painted</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pkg.posterDataUrl} alt="Generated teaser poster" className="rounded-xl border border-line w-full" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "memo" && (
              <div className="grid lg:grid-cols-[1fr_280px] gap-5 items-start">
                <article className="memo rounded-2xl border border-line bg-panel p-6 sm:p-8">
                  <ReactMarkdown>{pkg.memo}</ReactMarkdown>
                </article>
                <div className="rounded-2xl border border-line bg-panel p-5 text-sm leading-6">
                  <div className="font-semibold mb-1">What this is</div>
                  <p className="text-muted">
                    The one-page note a development executive would put in front of the people who decide what gets made. Every figure comes from
                    the research, with links.
                  </p>
                  <a href={memoHref} download={`greenlight-${slug(pkg.analysis.title)}-memo.md`} className="mt-4 block text-center px-4 py-2.5 rounded-xl border border-line hover:border-gold/70 hover:text-gold transition">
                    Download the memo
                  </a>
                </div>
              </div>
            )}

            {tab === "numbers" && (
              <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
                <div className="rounded-2xl border border-line bg-panel p-5 overflow-x-auto">
                  <div className="font-semibold">Films like yours, and how they did</div>
                  <div className="text-xs text-muted mb-3">Click a title to open the source.</div>
                  <table className="w-full text-sm">
                    <thead className="text-muted text-left">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Title</th>
                        <th className="py-2 pr-3 font-medium">Cost to make</th>
                        <th className="py-2 pr-3 font-medium">Earned worldwide</th>
                        <th className="py-2 pr-3 font-medium">Where it played</th>
                        <th className="py-2 pr-3 font-medium">Why it&apos;s similar</th>
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
                    <div className="font-semibold mb-2">The market right now</div>
                    <div className="text-sm">{pkg.analysis.market.trend}</div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {pkg.analysis.market.keyStats.map((s) => (
                        <div key={s.label} className="rounded-lg bg-panel-2 border border-line p-3">
                          <div className="text-xl font-extrabold text-gold">{s.value}</div>
                          <div className="text-[11px] text-muted mt-1 leading-4">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-sm text-muted mt-3">
                      <span className="text-foreground">Who will watch:</span> {pkg.analysis.market.audience}
                    </div>
                    <div className="text-sm text-muted mt-1">
                      <span className="text-foreground">When to release:</span> {pkg.analysis.market.timing}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line bg-panel p-5">
                    <div className="font-semibold mb-1">Suggested budget</div>
                    <div className="text-3xl font-extrabold text-gold">{fmtM(pkg.analysis.budget.recommendedUsdM)}</div>
                    <div className="text-sm text-muted">
                      sensible range {fmtM(pkg.analysis.budget.lowUsdM)} to {fmtM(pkg.analysis.budget.highUsdM)}
                    </div>
                    <div className="text-sm text-muted mt-2">{pkg.analysis.budget.rationale}</div>
                  </div>
                  <div className="rounded-2xl border border-line bg-panel p-5">
                    <div className="font-semibold mb-2">What could go wrong</div>
                    <ul className="flex flex-col gap-2 text-sm">
                      {pkg.analysis.risks.map((r) => (
                        <li key={r.risk} className="flex gap-3">
                          <span className={`text-[10px] uppercase tracking-wider mt-1 w-14 shrink-0 ${r.severity === "high" ? "text-red" : r.severity === "medium" ? "text-amber" : "text-green"}`}>
                            {r.severity}
                          </span>
                          <span>
                            <span className="font-medium">{r.risk}</span> <span className="text-muted">— fix: {r.mitigation}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {tab === "sources" && (
              <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
                <article className="memo rounded-2xl border border-line bg-panel p-6 text-sm">
                  <div className="font-semibold mb-1">The researcher&apos;s notes</div>
                  <div className="text-xs text-muted mb-3">Written from live web searches. Nothing here is invented: missing figures say &quot;n/a&quot;.</div>
                  <ReactMarkdown>{pkg.research}</ReactMarkdown>
                </article>
                <div className="rounded-2xl border border-line bg-panel p-5">
                  <div className="font-semibold mb-1">{pkg.sources.length} web pages checked</div>
                  <div className="text-xs text-muted mb-3">Found with Parallel&apos;s web search. Open any of them.</div>
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
            <div className="font-semibold mb-1">Your recent pitches</div>
            <div className="text-xs text-muted mb-3">Saved in this browser only. Click one to open it again.</div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => {
                      setPkg(h);
                      setTab("video");
                      setRender({ state: "idle" });
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

        <footer className="text-xs text-muted text-center py-6 leading-6">
          Made for Agentic Cinema, the Google Cloud hackathon (Parallel track).
          <br />
          Thinking by Gemini on Google Cloud · Web research by Parallel · Video by Remotion ·{" "}
          <a href="https://github.com/AtharvaRasal/greenlight" className="hover:text-gold underline underline-offset-2">
            open source on GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
