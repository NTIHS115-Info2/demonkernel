import type { LlmStreamEmitter } from "./types";

export type CollectedStreamChunk = {
  content: string;
  raw: unknown;
  reasoning: string;
};

export type CollectStreamReplyHooks = {
  onChunk?: (chunk: CollectedStreamChunk) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractReasoningFromRaw(raw: unknown): string {
  if (!isRecord(raw)) {
    return "";
  }

  const choices = raw.choices;
  if (Array.isArray(choices) && choices.length > 0 && isRecord(choices[0])) {
    const choice = choices[0];
    const delta = isRecord(choice.delta) ? choice.delta : null;
    if (delta && typeof delta.reasoning_content === "string") {
      return delta.reasoning_content;
    }
    if (typeof choice.reasoning_content === "string") {
      return choice.reasoning_content;
    }
  }

  if (typeof raw.reasoning_content === "string") {
    return raw.reasoning_content;
  }

  return "";
}

function parseCollectedChunk(args: unknown[]): CollectedStreamChunk {
  const first = args[0];
  const raw = args.length > 1 ? args[1] : null;
  const reasoningArg = args.length > 2 ? args[2] : null;

  const content = typeof first === "string"
    ? first
    : (first === null || first === undefined ? "" : String(first));
  const reasoning = typeof reasoningArg === "string"
    ? reasoningArg
    : extractReasoningFromRaw(raw);

  return {
    content,
    raw,
    reasoning,
  };
}

export async function collectStreamReply(
  stream: LlmStreamEmitter,
  hooks: CollectStreamReplyHooks = {}
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];

    const onData = (...args: unknown[]): void => {
      const parsed = parseCollectedChunk(args);
      hooks.onChunk?.(parsed);

      if (parsed.content.length > 0) {
        chunks.push(parsed.content);
      }
    };

    const onError = (error: unknown): void => {
      cleanup();
      reject(error);
    };

    const onEnd = (): void => {
      cleanup();
      resolve(chunks.join(""));
    };

    const cleanup = (): void => {
      stream.off("data", onData);
      stream.off("error", onError);
      stream.off("end", onEnd);
    };

    stream.on("data", onData);
    stream.on("error", onError);
    stream.on("end", onEnd);
  });
}
