# Devpost submission draft — Greenlight

> Fill the Devpost form from this file. Keep the video ≤ 3:00 and make sure it shows the agent *working* (their rule: not a cinematic trailer).

## Project name
Greenlight — the studio development-exec agent

## Tagline (≤ 80 chars)
Type a logline. Get comps, a greenlight memo and a rendered pitch reel in 90s.

## Partner track
Parallel

## Inspiration
Before a studio or streamer says yes to a project, a development exec and an analyst spend days on the same grind: pull comparable titles, dig up budgets and grosses, read the trades for genre trends, size the audience, band a budget, write the memo. Almost all of it is web research plus structured reasoning — exactly what a tool-calling agent is good at. We wanted the output to be something a room of executives would actually *watch*, so the agent ends by rendering a pitch reel from its own findings.

## What it does
Paste a one-sentence logline and Greenlight runs a three-agent development team built on Google's Agent Development Kit and Gemini:

1. **Scout** calls the **Parallel Search API** four to six times with distinct objectives — comps with budgets and worldwide grosses (aimed at Box Office Mojo / The Numbers), streaming comps (aimed at the trades), genre trend, audience, competing projects — and writes cited research notes.
2. **Analyst** turns the notes into a strict JSON analysis: 4–6 comps with source URLs, three headline stats, a risk register, a budget band, and a GREENLIGHT / DEVELOP / PASS verdict with confidence.
3. **Producer** writes the exec memo and the poster art direction; a Gemini image model on Vertex AI paints the teaser key art.

Everything streams live to the browser — which agent is working, every Parallel search with its queries and hit count, the Scout's notes as they are written. Then **Remotion** renders a 30-second pitch reel from the agent's JSON: title card over the generated poster, the logline, an animated comps chart, market stats, risks, the budget band and the verdict stamp. Memo, comps table, research notes and every source are one click away, and the whole package downloads as JSON.

## How we built it
- **Google ADK (TypeScript)**: `LlmAgent` ×3 composed in a `SequentialAgent`, run by `InMemoryRunner` in SSE streaming mode; agents hand off through session state via `outputKey`; structured outputs via Zod → `outputSchema`.
- **Gemini** (`gemini-2.5-flash`) for all reasoning; `gemini-2.5-flash-image` on **Vertex AI** for the poster (`@google/genai`).
- **Parallel Search API** via the official `parallel-web` SDK, wrapped as an ADK `FunctionTool`, with `source_policy.include_domains` so the agent can aim at box-office databases or trade press.
- **Remotion** for the reel (Player in the browser; `@remotion/renderer` for MP4 export).
- **Next.js 16** app with a streaming API route, deployed to **Cloud Run** (Secret Manager for the Parallel key, service-account auth to Vertex AI).

## Challenges we ran into
- Getting a tool-calling agent to produce *numbers with sources* rather than vibes: domain-focused searches plus an explicit "never invent figures, write n/a" contract fixed it.
- Gemini's free-tier API key can't generate images, and Vertex's prompt filter blocked the phrase "no watermark" — moving the poster to Vertex and trimming the negative prompt solved both.
- New Google Cloud projects don't give Cloud Build's default service account storage rights; the deploy script now grants them.

## Accomplishments we're proud of
A complete product, not a demo: real research with citations, a verdict an exec can argue with, and a video out the other end — in about 90 seconds, for a few cents a run.

## What we learned
ADK's session-state hand-off makes a deterministic multi-agent pipeline easy to reason about; Parallel's excerpt-first results are exactly the shape an LLM tool call wants.

## What's next
Task API deep-research mode for franchise-level packages, comps chart from live box-office feeds, one-click MP4 export from Cloud Run, and a shareable link per package.

## Built with
google-adk · gemini · vertex-ai · google-genai · parallel-web · remotion · next.js · typescript · cloud-run · secret-manager · tailwind · zod

## Links
- Try it: _Cloud Run URL_
- Code: https://github.com/AtharvaRasal/greenlight (MIT)
- Video: _YouTube URL_

---

# Demo video script (≤ 3:00) — screen recording, no trailer

**0:00–0:20 · Hook (talking over the live app, blank state)**
"This is Greenlight. Studios spend days deciding what to make — pulling comps, budgets, grosses, trends — before anyone writes the memo. Greenlight is a Gemini agent team that does that grind in ninety seconds, with sources, and ends with a pitch reel you can watch. Let me type a logline."

**0:20–0:40 · Input**
Type (or click Example 2): the whale/volcano logline. Click *Run the greenlight process*. Point at the right-hand card: "Google ADK, Gemini, Parallel Search API."

**0:40–1:40 · Agents working (this is the part the judges need to see)**
- As the Scout starts: "Agent one, the Scout, is calling the Parallel Search API — you can see each call: the objective, the queries, how many results came back, in about two seconds each."
- Point at a box-office call: "This one is aimed at Box Office Mojo and The Numbers so we get real budgets and grosses."
- As notes stream: "Its research notes stream in with URLs — no invented numbers; if it can't find a figure it writes n/a."
- Analyst → Producer ticks: "The Analyst turns that into strict JSON — comps, risks, budget band, verdict. The Producer writes the memo and the poster brief; Gemini on Vertex AI paints the key art."

**1:40–2:20 · The result**
- Verdict banner: read the decision and the headline. "Five Parallel searches, twenty-two sources, one Gemini model."
- Reel plays: let 15 s run. "Remotion renders this from the agent's JSON — title over the generated poster, comps chart, market stats, risks, budget, verdict."
- Click *Greenlight memo*: scroll once. Click *Comps & market*: "every comp links to its source." Click *Research & sources*.

**2:20–2:45 · How it's built (show the repo README diagram for 10 s)**
"Three ADK LlmAgents in a SequentialAgent, handing off through session state. The Parallel Search SDK is wrapped as an ADK FunctionTool. Deployed on Cloud Run, models on Vertex AI, key in Secret Manager. MIT, all on GitHub."

**2:45–3:00 · Close**
"Logline in, greenlight package out — research you can check, a decision you can argue with, and a reel you can send. Greenlight, for the Parallel track."

**Recording notes:** 1920×1080, browser at 100 %, hide bookmarks bar, close dev tools, use the Cloud Run URL (not localhost), run one warm-up request first so Cloud Run is hot, record with the built-in Windows tool (Win+Alt+R) or OBS, English narration, upload to YouTube as Public/Unlisted-off, title "Greenlight — Agentic Cinema demo (Parallel track)".
