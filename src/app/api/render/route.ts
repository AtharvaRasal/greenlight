// POST { logline, analysis, posterDataUrl? } -> video/mp4
// Renders the PitchReel composition server-side with Remotion using the prebuilt bundle
// (remotion-build/, produced by `npm run remotion:bundle` at image build time).
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AnalysisSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 600;

// One render at a time per instance keeps memory predictable on Cloud Run.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

export async function POST(req: Request) {
  let body: { logline?: string; analysis?: unknown; posterDataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = AnalysisSchema.safeParse(body.analysis);
  if (!parsed.success || !body.logline) return Response.json({ error: "Missing or invalid analysis/logline" }, { status: 400 });
  const posterDataUrl = typeof body.posterDataUrl === "string" && body.posterDataUrl.startsWith("data:image/") ? body.posterDataUrl : undefined;

  const serveUrl = process.env.REMOTION_SERVE_URL || path.join(process.cwd(), "remotion-build");
  if (!serveUrl.startsWith("http") && !existsSync(path.join(serveUrl, "index.html"))) {
    return Response.json({ error: "Video renderer is not available on this server (bundle missing). Run `npm run remotion:bundle`." }, { status: 503 });
  }

  const inputProps = { logline: body.logline, analysis: parsed.data, posterDataUrl };
  const outputLocation = path.join(os.tmpdir(), `greenlight-${randomUUID()}.mp4`);
  const started = Date.now();

  try {
    await serialize(async () => {
      const composition = await selectComposition({ serveUrl, id: "PitchReel", inputProps });
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation,
        inputProps,
        // 1280x720 keeps a 30 s render around a minute on 2 vCPUs.
        scale: 2 / 3,
        crf: 22,
        concurrency: Number(process.env.REMOTION_CONCURRENCY || 2),
        chromiumOptions: { gl: "swangle", disableWebSecurity: false },
        timeoutInMilliseconds: 120_000,
      });
    });
    const buf = await readFile(outputLocation);
    await unlink(outputLocation).catch(() => undefined);
    console.log(`[render] ${buf.length} bytes in ${Date.now() - started}ms`);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(buf.length),
        "Content-Disposition": `attachment; filename="greenlight-pitch-reel.mp4"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    await unlink(outputLocation).catch(() => undefined);
    const message = (err as Error).message ?? String(err);
    console.error("[render] failed:", message);
    return Response.json({ error: message.slice(0, 300) }, { status: 500 });
  }
}
