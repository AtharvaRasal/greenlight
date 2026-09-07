// Parallel Search API integration (https://docs.parallel.ai/search-api)
// Called at runtime by the Scout agent's `parallel_search` FunctionTool.
import Parallel from "parallel-web";
import type { Source, ToolCall } from "./types";

let client: Parallel | null = null;

export function getParallelClient(): Parallel {
  if (!client) {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) throw new Error("PARALLEL_API_KEY is not set");
    client = new Parallel({ apiKey });
  }
  return client;
}

export type SearchHit = {
  url: string;
  title: string;
  publishDate: string | null;
  excerpt: string;
};

export type SearchOutcome = {
  hits: SearchHit[];
  call: ToolCall;
};

const MAX_EXCERPT_CHARS = 900;

/**
 * Run one Parallel web search. `mode: "advanced"` gives the best excerpts for
 * research; results come back in <5s. Excerpts are trimmed so the agent's
 * context stays small.
 */
export async function parallelSearch(objective: string, queries: string[]): Promise<SearchOutcome> {
  const started = Date.now();
  const res = await getParallelClient().search({
    objective,
    search_queries: queries.slice(0, 4),
    mode: "advanced",
    max_chars_total: 9000,
    advanced_settings: { max_results: 6 },
  });

  const hits: SearchHit[] = (res.results ?? []).map((r) => ({
    url: r.url,
    title: r.title ?? r.url,
    publishDate: r.publish_date ?? null,
    excerpt: (r.excerpts ?? []).join(" … ").replace(/\s+/g, " ").slice(0, MAX_EXCERPT_CHARS),
  }));

  return {
    hits,
    call: {
      tool: "parallel_search",
      objective,
      queries,
      resultCount: hits.length,
      durationMs: Date.now() - started,
    },
  };
}

export function hitsToSources(hits: SearchHit[]): Source[] {
  return hits.map((h) => ({ url: h.url, title: h.title, publishDate: h.publishDate }));
}
