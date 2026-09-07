import { z } from "zod";

// Zod schemas double as Gemini structured-output schemas (ADK converts them).

export const CompSchema = z.object({
  title: z.string(),
  year: z.number().int(),
  budgetUsdM: z.number().nullable().describe("Production budget in USD millions, null if unknown"),
  worldwideGrossUsdM: z.number().nullable().describe("Worldwide box office in USD millions, null if streaming-only/unknown"),
  platform: z.string().describe("e.g. Theatrical (Universal), Netflix, Prime Video"),
  whyComparable: z.string().describe("One sentence"),
  sourceUrl: z.string().describe("URL from the research notes that supports the numbers"),
});

export const AnalysisSchema = z.object({
  title: z.string().describe("Punchy working title, 1-3 words, uppercase"),
  tagline: z.string().describe("Poster tagline, max 10 words"),
  genre: z.string().describe("Primary genre label, 1-3 words"),
  comps: z.array(CompSchema).min(3).max(6),
  market: z.object({
    genre: z.string(),
    audience: z.string().describe("Core audience in one sentence"),
    trend: z.string().describe("One-sentence market trend headline"),
    timing: z.string().describe("Recommended release window and why"),
    keyStats: z
      .array(z.object({ label: z.string(), value: z.string().describe("Short figure like '2.1x' or '$412M'") }))
      .min(3)
      .max(3),
  }),
  risks: z
    .array(
      z.object({
        risk: z.string().describe("Max 8 words"),
        severity: z.enum(["low", "medium", "high"]),
        mitigation: z.string().describe("One sentence"),
      }),
    )
    .min(3)
    .max(4),
  budget: z.object({
    lowUsdM: z.number(),
    highUsdM: z.number(),
    recommendedUsdM: z.number(),
    rationale: z.string().describe("One or two sentences grounded in the comps"),
  }),
  verdict: z.object({
    decision: z.enum(["GREENLIGHT", "DEVELOP", "PASS"]),
    confidence: z.number().min(0).max(100),
    headline: z.string().describe("One-sentence verdict, max 20 words"),
    rationale: z.string().describe("Two or three sentences"),
  }),
});

export const ProducerSchema = z.object({
  memo: z.string().describe("The full greenlight memo in markdown"),
  posterPrompt: z.string().describe("Art direction for a teaser poster image, 1-2 sentences, no text in image"),
});

export type AnalysisOut = z.infer<typeof AnalysisSchema>;
export type ProducerOut = z.infer<typeof ProducerSchema>;
