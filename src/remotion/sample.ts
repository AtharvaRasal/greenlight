import type { Analysis } from "@/lib/types";

// Sample data so the Remotion Studio / Player has something to show before a run.
export const sampleLogline =
  "A washed-up Bollywood stunt double is hired to fake a billionaire's death for an insurance scam — and discovers the man is already dead.";

export const sampleAnalysis: Analysis = {
  title: "DOUBLE TAKE",
  tagline: "Every stunt has a body count.",
  genre: "Action Comedy",
  comps: [
    { title: "The Fall Guy", year: 2024, budgetUsdM: 130, worldwideGrossUsdM: 181, platform: "Theatrical (Universal)", whyComparable: "Stunt-performer action comedy", sourceUrl: "https://www.boxofficemojo.com" },
    { title: "Kill Boksoon", year: 2023, budgetUsdM: 20, worldwideGrossUsdM: null, platform: "Netflix", whyComparable: "Streaming action with dark comic tone", sourceUrl: "https://www.netflix.com" },
    { title: "Bullet Train", year: 2022, budgetUsdM: 90, worldwideGrossUsdM: 240, platform: "Theatrical (Sony)", whyComparable: "Ensemble crime comedy", sourceUrl: "https://www.boxofficemojo.com" },
    { title: "RRR", year: 2022, budgetUsdM: 72, worldwideGrossUsdM: 160, platform: "Theatrical + Netflix", whyComparable: "Indian action crossover", sourceUrl: "https://www.boxofficemojo.com" },
  ],
  market: {
    genre: "Action Comedy",
    audience: "18–44 co-viewing, South Asian diaspora + global streaming action fans",
    trend: "Mid-budget action comedies over-index on streaming; Indian crossover titles are the fastest-growing licensing category.",
    timing: "Q4 2027 streaming window",
    keyStats: [
      { label: "Median comp ROI", value: "2.1×" },
      { label: "Indian content licensing growth", value: "+38%" },
      { label: "Global action-comedy releases 2025", value: "41" },
    ],
  },
  risks: [
    { risk: "Tone whiplash between comedy and crime", severity: "medium", mitigation: "Attach a director with proven tonal control" },
    { risk: "Stunt-heavy budget creep", severity: "high", mitigation: "Pre-viz all set pieces; cap at 3 tentpole sequences" },
    { risk: "Crowded action-comedy slate", severity: "low", mitigation: "Lean into the Mumbai setting as differentiator" },
  ],
  budget: { lowUsdM: 18, highUsdM: 40, recommendedUsdM: 28, rationale: "Comps show diminishing returns above $40M for streaming-first action comedy; $28M funds three practical set pieces." },
  verdict: {
    decision: "GREENLIGHT",
    confidence: 74,
    headline: "A commercially legible hook with a fresh setting and a clear streaming buyer.",
    rationale: "Strong comps, defined audience, manageable budget band.",
  },
};
