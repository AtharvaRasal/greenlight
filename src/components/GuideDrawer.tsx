"use client";

import { useEffect } from "react";

export function GuideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="How to use Greenlight">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-panel border-l border-line shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-panel/95 backdrop-blur border-b border-line px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg">How Greenlight works</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-line hover:border-gold/70 hover:text-gold" aria-label="Close guide">
            ×
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-8 text-[15px] leading-7">
          <section>
            <h3 className="font-semibold text-gold text-xs uppercase tracking-[0.2em] mb-2">What it is</h3>
            <p>
              Before a studio or a streamer says yes to a film, someone spends days finding similar films, checking what they cost and earned,
              reading the trade press and writing a memo. Greenlight does that job for your idea in about 90 seconds, and shows you every
              step.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gold text-xs uppercase tracking-[0.2em] mb-2">How to use it</h3>
            <ol className="flex flex-col gap-3">
              {[
                ["Write one sentence", "Who the story is about, what they want, and what stands in the way. Or click an example."],
                ["Press “Get my verdict”", "Four AI specialists start working. You can watch every web search happen in the live feed."],
                ["Read your verdict", "GREENLIGHT, DEVELOP or PASS, plus how sure the team is."],
                ["Explore the results", "Watch the pitch video, read the memo, check the numbers, open the sources."],
                ["Download", "The video as MP4 and the memo as a text file. Send them to anyone."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-gold text-black text-xs font-bold inline-flex items-center justify-center mt-1">{i + 1}</span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="text-muted text-sm">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-gold text-xs uppercase tracking-[0.2em] mb-2">The team</h3>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <span className="font-semibold text-foreground">Researcher</span> <span className="text-muted">searches the live web for films like yours, their budgets, earnings, the market and the audience. Every search is real and shown to you.</span>
              </li>
              <li>
                <span className="font-semibold text-foreground">Analyst</span> <span className="text-muted">compares the numbers, lists the risks, suggests a budget and decides the verdict.</span>
              </li>
              <li>
                <span className="font-semibold text-foreground">Writer</span> <span className="text-muted">writes the one-page memo a studio would read.</span>
              </li>
              <li>
                <span className="font-semibold text-foreground">Poster artist</span> <span className="text-muted">paints the key art that opens your pitch video.</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gold text-xs uppercase tracking-[0.2em] mb-2">Reading the verdict</h3>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <span className="font-bold text-green">GREENLIGHT</span> <span className="text-muted">— the numbers support making it.</span>
              </li>
              <li>
                <span className="font-bold text-amber">DEVELOP</span> <span className="text-muted">— promising, but fix something first: the script, the budget, or who is attached.</span>
              </li>
              <li>
                <span className="font-bold text-red">PASS</span> <span className="text-muted">— the market or the comparable films argue against it right now.</span>
              </li>
            </ul>
            <p className="text-muted text-sm mt-2">The percentage is how confident the team is. Below 60% means the evidence was thin.</p>
          </section>

          <section>
            <h3 className="font-semibold text-gold text-xs uppercase tracking-[0.2em] mb-2">Tips for a good pitch</h3>
            <ul className="list-disc pl-5 text-sm text-muted flex flex-col gap-1">
              <li>Name the hero, the goal and the obstacle in one breath.</li>
              <li>Say if it is a film or a series; the team will look for the right comparisons.</li>
              <li>A setting or a period helps: “1950s Lagos” finds better matches than “a city”.</li>
              <li>Unusual ideas are fine. If little exists that is similar, the team will say so instead of guessing.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gold text-xs uppercase tracking-[0.2em] mb-2">Good to know</h3>
            <ul className="list-disc pl-5 text-sm text-muted flex flex-col gap-1">
              <li>A run takes 60 to 120 seconds. Rendering the MP4 takes another one to three minutes.</li>
              <li>Figures come from real web pages, with links. When a number can&apos;t be found, it says “n/a” rather than making one up.</li>
              <li>Your recent pitches are saved in this browser only.</li>
              <li>Occasionally the poster is skipped if the image model declines a scene. The video still works.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-panel-2 p-4 text-xs text-muted leading-5">
            <div className="font-semibold text-foreground mb-1">For the technically curious</div>
            The team is built with Google&apos;s Agent Development Kit and runs on Gemini. Web research uses the Parallel Search API as a tool the
            Researcher calls itself. The video is rendered with Remotion. It runs on Google Cloud Run and the code is open source on GitHub.
          </section>
        </div>
      </aside>
    </div>
  );
}
