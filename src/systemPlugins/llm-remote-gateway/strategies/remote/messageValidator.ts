import { createKernelLogger } from "../../../../core/logger";

const logger = createKernelLogger("plugin-llm-remote-gateway-validator", {
  plugin: "llm-remote-gateway",
  type: "system",
  strategy: "remote",
  module: "message-validator",
});

export const VALID_ROLES = Object.freeze(["system", "user", "assistant", "tool"]);

export const FORBIDDEN_FIELDS = Object.freeze([
  "reasoning_content",
  "timestamp",
  "talker",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateMessage(
  message: unknown,
  index = 0
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(message)) {
    return { valid: false, errors: [`message ${index} must be an object`] };
  }

  const role = message.role;
  if (typeof role !== "string") {
    errors.push(`message ${index} missing role`);
  } else if (!VALID_ROLES.includes(role)) {
    errors.push(`message ${index} role "${role}" is not allowed`);
  }

  const content = message.content;
  const toolCalls = message.tool_calls;
  const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
  const canHaveNullContent = role === "assistant" && hasToolCalls;

  if (content === undefined || content === null) {
    if (!canHaveNullContent) {
      errors.push(`message ${index} missing content`);
    }
  } else if (typeof content !== "string") {
    logger.warn("message content is not string, will coerce", { index });
  }

  if (role === "assistant" && Array.isArray(toolCalls)) {
    for (let i = 0; i < toolCalls.length; i += 1) {
      const toolCall = toolCalls[i];
      if (!isRecord(toolCall)) {
        errors.push(`message ${index}.tool_calls[${i}] must be an object`);
        continue;
      }

      if (typeof toolCall.id !== "string" || toolCall.id.length === 0) {
        errors.push(`message ${index}.tool_calls[${i}] missing id`);
      }

      if (!isRecord(toolCall.function)) {
        errors.push(`message ${index}.tool_calls[${i}] missing function`);
      } else if (typeof toolCall.function.name !== "string" || toolCall.function.name.length === 0) {
        errors.push(`message ${index}.tool_calls[${i}].function missing name`);
      }
    }
  }

  if (role === "tool") {
    if (typeof message.name !== "string" || message.name.length === 0) {
      errors.push(`message ${index} role=tool missing name`);
    }

    if (!message.tool_call_id) {
      logger.warn("tool role message without tool_call_id", { index });
    }
  }

  const foundForbiddenFields = FORBIDDEN_FIELDS.filter((field) => message[field] !== undefined);
  if (foundForbiddenFields.length > 0) {
    logger.warn("message contains forbidden fields and will be sanitized", {
      index,
      fields: foundForbiddenFields,
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 清理 message 只保留 OpenAI 相容欄位
 * Sanitize each message to OpenAI-compatible fields only.
 */
export function cleanMessage(message: unknown, index = 0): Record<string, unknown> | null {
  if (!isRecord(message)) {
    logger.warn("invalid message skipped", { index });
    return null;
  }

  const role = message.role;
  if (typeof role !== "string" || !VALID_ROLES.includes(role)) {
    logger.warn("invalid role skipped", { index, role });
    return null;
  }

  let content = message.content;
  if (content === undefined || content === null) {
    const hasToolCalls = role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
    content = hasToolCalls ? null : "";
  } else if (typeof content !== "string") {
    try {
      content = JSON.stringify(content);
    } catch {
      content = String(content);
    }
  }

  const cleaned: Record<string, unknown> = {
    role,
    content,
  };

  if (role === "tool") {
    if (typeof message.name !== "string" || message.name.length === 0) {
      logger.warn("tool message missing valid name; skipped", { index });
      return null;
    }
    cleaned.name = message.name;
    if (typeof message.tool_call_id === "string" && message.tool_call_id.length > 0) {
      cleaned.tool_call_id = message.tool_call_id;
    }
  }

  if (role === "assistant" && Array.isArray(message.tool_calls)) {
    cleaned.tool_calls = message.tool_calls;
  }

  return cleaned;
}

/**
 * 清理並驗證整個訊息陣列
 * Clean and validate the full messages array before sending.
 */
export function cleanAndValidateMessages(messages: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array");
  }

  const cleaned: Array<Record<string, unknown>> = [];
  const skippedIndexes: number[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const validation = validateMessage(messages[index], index);
    if (!validation.valid) {
      logger.warn("message validation failed, trying sanitize fallback", {
        index,
        errors: validation.errors,
      });
    }

    const cleanedMessage = cleanMessage(messages[index], index);
    if (cleanedMessage) {
      cleaned.push(cleanedMessage);
    } else {
      skippedIndexes.push(index);
    }
  }

  if (skippedIndexes.length > 0) {
    logger.warn("messages skipped after sanitize", { skippedIndexes });
  }

  if (cleaned.length === 0) {
    throw new Error("no valid messages after sanitize");
  }

  return cleaned;
}

export function validateChatPayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    return { valid: false, errors: ["payload must be an object"] };
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    errors.push("payload.messages must be a non-empty array");
  }

  if (payload.model !== undefined && typeof payload.model !== "string") {
    errors.push("payload.model must be a string");
  }

  if (payload.stream !== undefined && typeof payload.stream !== "boolean") {
    errors.push("payload.stream must be a boolean");
  }

  if (Array.isArray(payload.messages)) {
    payload.messages.forEach((message, index) => {
      if (!isRecord(message)) {
        errors.push(`payload.messages[${index}] must be an object`);
        return;
      }

      FORBIDDEN_FIELDS.forEach((field) => {
        if (message[field] !== undefined) {
          errors.push(`payload.messages[${index}] contains forbidden field "${field}"`);
        }
      });
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
