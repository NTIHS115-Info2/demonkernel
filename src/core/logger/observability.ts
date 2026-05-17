import type { LoggerObservabilityMeta } from "./index";

let requestSequence = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createObservabilityRequestId(
  scope: string,
  seed: {
    requestId?: string | null;
    conversationId?: string | null;
    userId?: string | null;
    channelId?: string | null;
  } = {}
): string {
  const direct = typeof seed.requestId === "string" ? seed.requestId.trim() : "";
  if (direct.length > 0) {
    return direct;
  }

  requestSequence += 1;
  const stamp = Date.now();
  const fragments = [
    scope,
    seed.conversationId ?? null,
    seed.userId ?? null,
    seed.channelId ?? null,
    String(stamp),
    String(requestSequence),
  ].filter((item) => typeof item === "string" && item.length > 0) as string[];
  return fragments.join(":");
}

export function summarizeText(
  value: string | null | undefined,
  maxChars = 120
): { preview: string | null; length: number; truncated: boolean } {
  if (typeof value !== "string") {
    return {
      preview: null,
      length: 0,
      truncated: false,
    };
  }

  if (value.length <= maxChars) {
    return {
      preview: value,
      length: value.length,
      truncated: false,
    };
  }

  return {
    preview: `${value.slice(0, maxChars)}...`,
    length: value.length,
    truncated: true,
  };
}

export function summarizeUnknown(
  value: unknown,
  options: {
    maxTextChars?: number;
    maxItems?: number;
    maxKeys?: number;
  } = {}
): unknown {
  const maxTextChars = options.maxTextChars ?? 120;
  const maxItems = options.maxItems ?? 3;
  const maxKeys = options.maxKeys ?? 8;

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return summarizeText(value, maxTextChars);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      preview: value.slice(0, maxItems).map((item) =>
        summarizeUnknown(item, {
          maxTextChars,
          maxItems: 2,
          maxKeys: 4,
        })
      ),
      truncated: value.length > maxItems,
    };
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const keys = Object.keys(value);
  const selected = keys.slice(0, maxKeys);
  const preview: Record<string, unknown> = {};
  for (const key of selected) {
    preview[key] = summarizeUnknown(value[key], {
      maxTextChars,
      maxItems: 2,
      maxKeys: 4,
    });
  }

  return {
    type: "object",
    keys: selected,
    preview,
    truncated: keys.length > selected.length,
  };
}

export function withObservability(
  meta: Record<string, unknown>,
  observability: LoggerObservabilityMeta
): Record<string, unknown> {
  return {
    ...meta,
    observability,
  };
}
