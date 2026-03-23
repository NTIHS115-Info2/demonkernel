import { TALK_ACTION_ALIAS_TO_ACTION } from "./constants";
import { composePromptMessages } from "./promptComposer";
import type { NormalizedTalkInput, TalkSendInput } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string") {
      normalized[key] = headerValue;
      continue;
    }
    if (typeof headerValue === "number" || typeof headerValue === "boolean") {
      normalized[key] = String(headerValue);
    }
  }

  if (Object.keys(normalized).length === 0) {
    return undefined;
  }
  return normalized;
}

function resolveAction(input: TalkSendInput): "talk.nostream" | "talk.stream" {
  if (typeof input.action === "string" && input.action in TALK_ACTION_ALIAS_TO_ACTION) {
    return TALK_ACTION_ALIAS_TO_ACTION[input.action as keyof typeof TALK_ACTION_ALIAS_TO_ACTION];
  }

  if (typeof input.message === "string" && input.message.trim().length > 0) {
    return "talk.nostream";
  }

  throw new Error(`unsupported action: ${String(input.action)}`);
}

export function normalizeTalkInput(options: TalkSendInput): NormalizedTalkInput {
  if (!isRecord(options)) {
    throw new Error("send options must be an object");
  }

  const action = resolveAction(options);
  const message = normalizeOptionalString(options.message);
  if (!message) {
    throw new Error(`${action} requires non-empty string field: message`);
  }

  return {
    action,
    message,
    talker: normalizeOptionalString(options.talker) ?? null,
    model: normalizeOptionalString(options.model),
    tools: Array.isArray(options.tools) ? options.tools : undefined,
    toolChoice: options.tool_choice,
    params: isRecord(options.params) ? options.params : {},
    timeoutMs: normalizeOptionalNumber(options.timeoutMs),
    connectionTimeoutMs: normalizeOptionalNumber(options.connectionTimeoutMs),
    maxRetries: normalizeOptionalNumber(options.maxRetries),
    retryDelayBaseMs: normalizeOptionalNumber(options.retryDelayBaseMs),
    reqId: normalizeOptionalString(options.reqId),
    reqIdHeader: normalizeOptionalString(options.reqIdHeader),
    headers: normalizeHeaders(options.headers),
  };
}

export function buildGatewayPayload(input: NormalizedTalkInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages: composePromptMessages(input),
  };

  if (input.model) {
    payload.model = input.model;
  }

  if (input.tools) {
    payload.tools = input.tools;
  }

  if (input.toolChoice !== undefined) {
    payload.tool_choice = input.toolChoice;
  }

  if (Object.keys(input.params).length > 0) {
    payload.params = input.params;
  }

  if (input.timeoutMs) {
    payload.timeoutMs = input.timeoutMs;
  }
  if (input.connectionTimeoutMs) {
    payload.connectionTimeoutMs = input.connectionTimeoutMs;
  }
  if (input.maxRetries !== undefined) {
    payload.maxRetries = input.maxRetries;
  }
  if (input.retryDelayBaseMs) {
    payload.retryDelayBaseMs = input.retryDelayBaseMs;
  }
  if (input.reqId) {
    payload.reqId = input.reqId;
  }
  if (input.reqIdHeader) {
    payload.reqIdHeader = input.reqIdHeader;
  }
  if (input.headers) {
    payload.headers = input.headers;
  }

  return payload;
}
