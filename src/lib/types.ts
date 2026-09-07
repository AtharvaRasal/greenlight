// Shared data model for a Greenlight run.
// The agent pipeline (src/lib/pipeline.ts) produces a GreenlightPackage;
// the UI and the Remotion pitch reel consume it.

export type Comp = {
  title: string;
  year: number;
  /** Production budget in USD millions (null if unknown) */
  budgetUsdM: number | null;
  /** Worldwide box office in USD millions (null if streaming-only / unknown) */
  worldwideGrossUsdM: number | null;
  /** Theatrical / Netflix / Prime Video / etc. */
  platform: string;
  whyComparable: string;
  sourceUrl: string;
};

export type KeyStat = { label: string; value: string };

export type Market = {
  genre: string;
  audience: string;
  trend: string;
  timing: string;
  keyStats: KeyStat[];
};

export type Risk = {
  risk: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
};

export type BudgetBand = {
  lowUsdM: number;
  highUsdM: number;
  recommendedUsdM: number;
  rationale: string;
};

export type Decision = "GREENLIGHT" | "DEVELOP" | "PASS";

export type Verdict = {
  decision: Decision;
  /** 0-100 */
  confidence: number;
  headline: string;
  rationale: string;
};

export type Analysis = {
  title: string;
  tagline: string;
  genre: string;
  comps: Comp[];
  market: Market;
  risks: Risk[];
  budget: BudgetBand;
  verdict: Verdict;
};

export type Source = {
  url: string;
  title: string;
  publishDate?: string | null;
};

export type ToolCall = {
  tool: string;
  focus?: "box_office" | "trade_press" | "any";
  objective: string;
  queries: string[];
  resultCount: number;
  durationMs: number;
};

export type GreenlightPackage = {
  id: string;
  logline: string;
  createdAt: string;
  /** Free-text research notes from the scout agent (with inline citations) */
  research: string;
  sources: Source[];
  toolCalls: ToolCall[];
  analysis: Analysis;
  /** Exec-ready greenlight memo (markdown) */
  memo: string;
  posterPrompt: string;
  /** data: URL of the Imagen poster, if generated */
  posterDataUrl?: string;
  models: { text: string; image?: string };
  timingsMs: Record<string, number>;
};

export type StageName = "scout" | "analyst" | "producer" | "poster";

export type ProgressEvent =
  | { type: "stage"; stage: StageName; status: "start" | "done"; ms?: number }
  | { type: "tool"; call: ToolCall }
  | { type: "text"; stage: StageName; delta: string }
  | { type: "note"; message: string }
  | { type: "result"; pkg: GreenlightPackage }
  | { type: "error"; message: string };
