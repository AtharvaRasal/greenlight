// The Greenlight agent team — built with Google's Agent Development Kit (ADK)
// and Gemini. Three specialists run in sequence and hand off via session state:
//
//   scout    (Gemini + Parallel Search tool)  -> state.research
//   analyst  (Gemini, structured output)      -> state.analysis
//   producer (Gemini, structured output)      -> state.producer  { memo, posterPrompt }

import { FunctionTool, LlmAgent, SequentialAgent, type ReadonlyContext } from "@google/adk";
import { z } from "zod";
import { parallelSearch, type SearchOutcome } from "./parallel";
import { AnalysisSchema, ProducerSchema } from "./schemas";

export const TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const stateStr = (ctx: ReadonlyContext, key: string): string => {
  const v = ctx.state.get(key);
  return typeof v === "string" ? v : v == null ? "" : JSON.stringify(v, null, 2);
};

/** Builds the tool set for one run so that tool calls can be reported to the UI. */
export function buildParallelSearchTool(onSearch: (o: SearchOutcome) => void, onError?: (message: string) => void) {
  return new FunctionTool({
    name: "parallel_search",
    description:
      "Live web research via the Parallel Search API. Returns ranked URLs with LLM-optimized excerpts. " +
      "Use it to find box office numbers, budgets, streaming performance, audience data and market trends. " +
      "Give a self-contained objective plus 2-3 focused search queries (3-6 words each).",
    parameters: z.object({
      objective: z.string().describe("What you are trying to learn, in one self-contained sentence"),
      search_queries: z.array(z.string()).min(1).max(3).describe("2-3 short keyword queries"),
      domain_focus: z
        .enum(["box_office", "trade_press", "any"])
        .describe(
          "box_office = restrict to Box Office Mojo / The Numbers / Wikipedia (budgets & grosses); trade_press = Variety, Deadline, THR, FlixPatrol, Netflix (market, streaming, development news); any = open web",
        ),
    }),
    execute: async ({ objective, search_queries, domain_focus }) => {
      let outcome;
      try {
        outcome = await parallelSearch(objective, search_queries, domain_focus);
      } catch (e) {
        // One retry after a short pause (rate limits / transient errors), then report to the model.
        await new Promise((r) => setTimeout(r, 1500));
        try {
          outcome = await parallelSearch(objective, search_queries, domain_focus);
        } catch (e2) {
          const message = (e2 as Error).message ?? String(e2);
          onError?.(message);
          return { error: `parallel_search failed: ${message.slice(0, 200)}. Try again with different queries.` };
        }
        void e;
      }
      onSearch(outcome);
      return {
        results: outcome.hits.map((h) => ({
          url: h.url,
          title: h.title,
          published: h.publishDate,
          excerpt: h.excerpt,
        })),
      };
    },
  });
}

export function buildGreenlightAgent(onSearch: (o: SearchOutcome) => void, onError?: (message: string) => void) {
  const scout = new LlmAgent({
    name: "scout",
    description: "Studio research analyst who gathers comparable-title and market data from the live web.",
    model: TEXT_MODEL,
    tools: [buildParallelSearchTool(onSearch, onError)],
    outputKey: "research",
    instruction: `You are the SCOUT, a research analyst in a film & TV studio's development department.
The user gives you a logline for a potential project. Your job is to gather hard evidence using the parallel_search tool.

Make 4 to 6 separate parallel_search calls, each with a distinct objective, covering:
1. Comparable released titles (same genre/tone/scale, ideally last 10 years). Think globally: include well-documented Hollywood and international comps, not only local-language ones. First call: domain_focus "box_office" to get production budget AND worldwide box office for 5-6 named comps (name the titles explicitly in the queries, e.g. "<title> box office budget"). Second call: domain_focus "trade_press" for streaming comps (platform, viewership, chart ranking).
2. The genre's recent market trend (domain_focus "trade_press"): growth, saturation, notable hits/misses, buyer appetite (studios/streamers).
3. Audience: who watches this kind of title, demographic and geographic notes.
4. Anything in development or recently announced that resembles this logline (competitive risk).

Then write RESEARCH NOTES in markdown:
- "## Comparable titles": one bullet per comp (aim for 5-6, at least 3 with BOTH a budget and a worldwide gross figure) with year, budget, worldwide gross or platform/performance, and the supporting URL in square brackets. Write "n/a" when a figure was not found. Never invent numbers. If your first pass lacks numbers for a comp, run one more box_office search naming that title.
- "## Market trend" (3-6 bullets with figures + URLs)
- "## Audience" (2-4 bullets)
- "## Competitive landscape" (1-3 bullets)
- "## Sources": list every URL you relied on.
Be concrete and numeric. Prefer figures in USD.`,
  });

  const analyst = new LlmAgent({
    name: "analyst",
    description: "Head of development who turns research into a structured greenlight analysis.",
    model: TEXT_MODEL,
    includeContents: "none",
    outputSchema: AnalysisSchema,
    outputKey: "analysis",
    instruction: (ctx) => `You are the ANALYST, head of development at a studio. Using ONLY the research notes below, produce the greenlight analysis as JSON matching the schema.

Rules:
- All money in USD millions (e.g. 100 for $100M). Use null when a number is genuinely unknown; never invent.
- Pick 4-6 comps ordered by relevance; each needs a sourceUrl taken from the notes.
- keyStats must be exactly 3 short, punchy figures that a pitch slide could show (e.g. "2.4x" median comp ROI, "$412M" avg gross, "+38%" genre growth). Derive them from the notes.
- risks: 3-4, each with severity and a one-line mitigation.
- budget: a low/high band and a recommended figure grounded in the comps and the logline's scale.
- verdict.decision: GREENLIGHT if comps and market clearly support it, DEVELOP if promising but needs work (script, attachment, budget fix), PASS if the market or comps argue against it. confidence 0-100.
- title: a punchy working title (1-3 words). tagline: max 10 words. genre: 1-3 words.

LOGLINE:
${stateStr(ctx, "logline")}

RESEARCH NOTES:
${stateStr(ctx, "research")}`,
  });

  const producer = new LlmAgent({
    name: "producer",
    description: "Executive producer who writes the greenlight memo and poster art direction.",
    model: TEXT_MODEL,
    includeContents: "none",
    outputSchema: ProducerSchema,
    outputKey: "producer",
    instruction: (ctx) => `You are the PRODUCER, an executive producer writing for the studio's greenlight committee.

Write two things as JSON:
1. "memo": an exec-ready GREENLIGHT MEMO in markdown, 350-550 words, with these sections:
   # <TITLE> — Greenlight Memo
   **Verdict:** <decision> (<confidence>% confidence) — one line
   ## The pitch  (logline + why now, 2-3 sentences)
   ## Comparable titles  (a markdown table: Title | Year | Budget | Worldwide / Platform | Why it matters)
   ## Market & audience  (3-5 bullets with figures)
   ## Risks  (bullets: risk — mitigation)
   ## Budget & path  (band, recommended figure, suggested buyer/route)
   ## Recommendation  (2-4 sentences, decisive)
   ## Sources  (bulleted URLs from the research)
   Use the numbers from the analysis; cite source URLs inline where useful.
2. "posterPrompt": art direction for a cinematic teaser poster (1-2 sentences): setting, key visual metaphor, lighting, palette, mood. Photoreal, widescreen. Explicitly: no text, no letters, no logos, no watermarks in the image.

LOGLINE:
${stateStr(ctx, "logline")}

ANALYSIS (JSON):
${stateStr(ctx, "analysis")}

RESEARCH NOTES:
${stateStr(ctx, "research")}`,
  });

  return new SequentialAgent({
    name: "greenlight",
    description: "Runs scout -> analyst -> producer to turn a logline into a greenlight package.",
    subAgents: [scout, analyst, producer],
  });
}
