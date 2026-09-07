// Teaser-poster generation with Google's image models via the google-genai SDK.
// Tries the Gemini image model first (available on the free tier), then Imagen.
import { GoogleGenAI, Modality } from "@google/genai";

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

async function viaGeminiImage(ai: GoogleGenAI, prompt: string): Promise<PosterResult | null> {
  const res = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: `Cinematic teaser poster key art, 16:9 widescreen, photoreal, dramatic lighting. ${prompt} No text, no letters, no logos, no watermark.`,
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: "16:9" } },
  });
  for (const part of res.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) return { dataUrl: `data:${part.inlineData?.mimeType || "image/png"};base64,${data}`, model: IMAGE_MODEL };
  }
  return null;
}

async function viaImagen(ai: GoogleGenAI, prompt: string): Promise<PosterResult | null> {
  const res = await ai.models.generateImages({
    model: IMAGEN_MODEL,
    prompt: `Cinematic teaser poster key art, photoreal, dramatic lighting. ${prompt} No text, no letters, no logos.`,
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
