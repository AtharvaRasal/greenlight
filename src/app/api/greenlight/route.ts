import { runGreenlight } from "@/lib/pipeline";
import type { ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST { logline } -> Server-Sent Events stream of ProgressEvent
export async function POST(req: Request) {
  let body: { logline?: string; poster?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const logline = (body.logline ?? "").trim();
  if (logline.length < 15) return Response.json({ error: "Logline too short" }, { status: 400 });
  if (logline.length > 600) return Response.json({ error: "Logline too long (max 600 chars)" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);
      try {
        await runGreenlight(logline, send, { poster: body.poster !== false });
      } catch (err) {
        send({ type: "error", message: (err as Error).message ?? String(err) });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
