import { createKernelLogger } from "../../../../core/logger";

import {
  cleanAndValidateMessages,
  validateChatPayload,
} from "./messageValidator";
import type { NormalizedChatPayload } from "./types";

const logger = createKernelLogger("plugin-llm-remote-gateway-payload", {
  plugin: "llm-remote-gateway",
  type: "system",
  strategy: "remote",
  module: "payload",
});

/**
 * 組裝 chat/completions payload 並做最終驗證
 * Build OpenAI chat/completions payload with validation.
 */
export function buildChatPayload(options: NormalizedChatPayload): Record<string, unknown> {
  const cleanedMessages = cleanAndValidateMessages(options.messages);

  const payload: Record<string, unknown> = {
    ...options.params,
    messages: cleanedMessages,
    stream: options.stream,
  };

  if (options.model) {
    payload.model = options.model;
  }

  if (options.tools && options.tools.length > 0) {
    payload.tools = options.tools;
    payload.tool_choice = options.tool_choice ?? "auto";
  }

  const validation = validateChatPayload(payload);
  if (!validation.valid) {
    const errorMessage = `chat payload invalid: ${validation.errors.join("; ")}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return payload;
}

export function extractCompletionContent(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) {
    return "";
  }

  const choices = raw.choices;
  if (Array.isArray(choices) && choices.length > 0 && typeof choices[0] === "object" && choices[0] !== null) {
    const choice = choices[0] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;
    const message = choice.message as Record<string, unknown> | undefined;

    if (delta && typeof delta.content === "string") {
      return delta.content;
    }
    if (message && typeof message.content === "string") {
      return message.content;
    }
  }

  if (typeof raw.content === "string") {
    return raw.content;
  }

  if (typeof raw.text === "string") {
    return raw.text;
  }

  return "";
}

export function extractReasoningContent(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) {
    return "";
  }

  const choices = raw.choices;
  if (Array.isArray(choices) && choices.length > 0 && typeof choices[0] === "object" && choices[0] !== null) {
    const choice = choices[0] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;

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

/**
 * 將 chunk 補齊為一致結構，讓上層解析邏輯更穩定
 * Normalize completion chunk into predictable shape for upper layers.
 */
export function normalizeCompletionChunk(rawInput: unknown): Record<string, unknown> {
  const raw = (rawInput && typeof rawInput === "object")
    ? { ...(rawInput as Record<string, unknown>) }
    : {};

  const content = extractCompletionContent(raw);
  const reasoningContent = extractReasoningContent(raw);

  const currentChoices = Array.isArray(raw.choices) ? [...raw.choices] : [];
  const firstChoice = (currentChoices[0] && typeof currentChoices[0] === "object")
    ? { ...(currentChoices[0] as Record<string, unknown>) }
    : {};
  const delta = (firstChoice.delta && typeof firstChoice.delta === "object")
    ? { ...(firstChoice.delta as Record<string, unknown>) }
    : {};

  if (content && typeof delta.content !== "string") {
    delta.content = content;
  }
  if (reasoningContent && typeof delta.reasoning_content !== "string") {
    delta.reasoning_content = reasoningContent;
  }

  firstChoice.delta = delta;
  currentChoices[0] = firstChoice;

  const normalized: Record<string, unknown> = {
    ...raw,
    choices: currentChoices.length > 0
      ? currentChoices
      : [{ delta: { content, reasoning_content: reasoningContent }, finish_reason: null }],
  };

  if (content && typeof normalized.content !== "string") {
    normalized.content = content;
  }
  if (reasoningContent && typeof normalized.reasoning_content !== "string") {
    normalized.reasoning_content = reasoningContent;
  }

  return normalized;
}
