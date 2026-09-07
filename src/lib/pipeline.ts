// Orchestrates one Greenlight run and streams progress events.
import { InMemoryRunner, StreamingMode, getFunctionCalls } from "@google/adk";
import { randomUUID } from "node:crypto";
import { buildGreenlightAgent, TEXT_MODEL } from "./agents";
import { hitsToSources, type SearchOutcome } from "./parallel";
import { generatePoster } from "./poster";
import { AnalysisSchema, ProducerSchema } from "./schemas";
import type { GreenlightPackage, ProgressEvent, Source, StageName, ToolCall } from "./types";

const APP = "greenlight";

function parseMaybeJson<T>(v: unknown, schema: { parse: (x: unknown) => T }): T {
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return schema.parse(JSON.parse(cleaned));
  }
  return schema.parse(v);
}

export async function runGreenlight(
  logline: string,
  emit: (e: ProgressEvent) => void,
  opts: { poster?: boolean } = {},
): Promise<GreenlightPackage> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const toolCalls: ToolCall[] = [];
  const sourceMap = new Map<string, Source>();

  const onSearch = (o: SearchOutcome) => {
    toolCalls.push(o.call);
    for (const s of hitsToSources(o.hits)) if (!sourceMap.has(s.url)) sourceMap.set(s.url, s);
    emit({ type: "tool", call: o.call });
  };

  const agent = buildGreenlightAgent(onSearch, (message) => emit({ type: "note", message: `parallel_search error: ${message.slice(0, 160)}` }));
  const runner = new InMemoryRunner({ agent, appName: APP });
  const userId = "exec";
  const session = await runner.sessionService.createSession({ appName: APP, userId, state: { logline } });

  let current: StageName | null = null;
  const stageStart: Partial<Record<StageName, number>> = {};
  const enter = (stage: StageName) => {
    if (current === stage) return;
    if (current) {
      timings[current] = Date.now() - (stageStart[current] ?? Date.now());
      emit({ type: "stage", stage: current, status: "done", ms: timings[current] });
    }
    current = stage;
    stageStart[stage] = Date.now();
    emit({ type: "stage", stage, status: "start" });
  };

  for await (const event of runner.runAsync({
    userId,
    sessionId: session.id,
    newMessage: { role: "user", parts: [{ text: `LOGLINE: ${logline}` }] },
    runConfig: { streamingMode: StreamingMode.SSE },
  })) {
    const author = event.author as StageName | undefined;
    if (author === "scout" || author === "analyst" || author === "producer") enter(author);

    if (event.errorMessage) emit({ type: "note", message: `${author ?? "agent"}: ${event.errorMessage}` });

    const calls = getFunctionCalls(event);
    for (const c of calls) {
      const args = (c.args ?? {}) as { objective?: string; search_queries?: string[] };
      emit({ type: "note", message: `scout → parallel_search: ${args.objective ?? JSON.stringify(args)}` });
    }

    if (event.partial && event.content?.parts && author === "scout") {
      const text = event.content.parts.map((p) => p.text ?? "").join("");
      if (text) emit({ type: "text", stage: author, delta: text });
    }
  }
  const closeCurrent = () => {
    if (!current) return;
    timings[current] = Date.now() - (stageStart[current] ?? Date.now());
    emit({ type: "stage", stage: current, status: "done", ms: timings[current] });
    current = null;
  };

  const final = await runner.sessionService.getSession({ appName: APP, userId, sessionId: session.id });
  const state = (final?.state ?? {}) as Record<string, unknown>;

  const research = typeof state.research === "string" ? state.research : JSON.stringify(state.research ?? "");
  const analysis = parseMaybeJson(state.analysis, AnalysisSchema);
  const producer = parseMaybeJson(state.producer, ProducerSchema);

  let posterDataUrl: string | undefined;
  let imageModel: string | undefined;
  if (opts.poster !== false) {
    closeCurrent();
    enter("poster");
    const { result, error } = await generatePoster(producer.posterPrompt);
    if (result) {
      posterDataUrl = result.dataUrl;
      imageModel = result.model;
    } else if (error) {
      emit({ type: "note", message: `poster skipped: ${error}` });
    }
    closeCurrent();
  } else {
    closeCurrent();
  }
  timings.total = Date.now() - t0;

  const pkg: GreenlightPackage = {
    id: randomUUID(),
    logline,
    createdAt: new Date().toISOString(),
    research,
    sources: [...sourceMap.values()],
    toolCalls,
    analysis,
    memo: producer.memo,
    posterPrompt: producer.posterPrompt,
    posterDataUrl,
    models: { text: TEXT_MODEL, image: imageModel },
    timingsMs: timings,
  };
  emit({ type: "result", pkg });
  return pkg;
}
