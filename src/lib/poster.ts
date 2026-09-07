// Teaser-poster generation with Google's image models via the google-genai SDK.
// Tries the Gemini image model first (available on the free tier), then Imagen.
import { GoogleGenAI, HarmBlockThreshold, HarmCategory, Modality } from "@google/genai";

export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
export const IMAGEN_MODEL = process.env.IMAGEN_MODEL || "imagen-4.0-fast-generate-001";

function makeClient(): GoogleGenAI {
  const useVertex = ["1", "true"].includes((process.env.GOOGLE_GENAI_USE_VERTEXAI || "").toLowerCase());
  if (useVertex) {
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    });
  }
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENAI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

export type PosterResult = { dataUrl: string; model: string };

const RELAXED_SAFETY = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }));

async function viaGeminiImage(ai: GoogleGenAI, prompt: string, attempt = 0): Promise<PosterResult | null> {
  const style =
    attempt === 0
      ? "Cinematic teaser poster key art, 16:9 widescreen, photoreal, dramatic lighting."
      : "Painterly illustrated movie poster key art, 16:9 widescreen, atmospheric, stylized, no people's faces.";
  const res = await ai.models.generateContent({
    model: IMAGE_MODEL,
    // NB: the words "no watermark" trip Vertex's prompt safety filter — keep the negative prompt minimal.
    contents: `${style} ${prompt} No text.`,
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: "16:9" }, safetySettings: RELAXED_SAFETY },
  });
  if (res.promptFeedback?.blockReason && attempt === 0) return viaGeminiImage(ai, prompt, 1);
  const cand = res.candidates?.[0];
  for (const part of cand?.content?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) return { dataUrl: `data:${part.inlineData?.mimeType || "image/png"};base64,${data}`, model: IMAGE_MODEL };
  }
  const text = cand?.content?.parts?.map((p) => p.text ?? "").join(" ").trim();
  throw new Error(
    `no image returned (finishReason=${cand?.finishReason ?? "?"}${res.promptFeedback?.blockReason ? `, blocked=${res.promptFeedback.blockReason}` : ""}${text ? `, text="${text.slice(0, 120)}"` : ""})`,
  );
}

async function viaImagen(ai: GoogleGenAI, prompt: string): Promise<PosterResult | null> {
  const res = await ai.models.generateImages({
    model: IMAGEN_MODEL,
    prompt: `Cinematic teaser poster key art, photoreal, dramatic lighting. ${prompt} No text.`,
    config: { numberOfImages: 1, aspectRatio: "16:9" },
  });
  const img = res.generatedImages?.[0]?.image;
  if (img?.imageBytes) return { dataUrl: `data:${img.mimeType || "image/png"};base64,${img.imageBytes}`, model: IMAGEN_MODEL };
  return null;
}

/** Returns null (never throws) so a poster failure never blocks the package. */
export async function generatePoster(prompt: string): Promise<{ result: PosterResult | null; error?: string }> {
  let ai: GoogleGenAI;
  try {
    ai = makeClient();
  } catch (e) {
    return { result: null, error: (e as Error).message };
  }
  const errors: string[] = [];
  for (const fn of [viaGeminiImage, viaImagen]) {
    try {
      const r = await fn(ai, prompt);
      if (r) return { result: r };
    } catch (e) {
      errors.push(`${fn.name}: ${(e as Error).message?.slice(0, 200)}`);
    }
  }
  return { result: null, error: errors.join(" | ") };
}
