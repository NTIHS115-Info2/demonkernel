import { RETRYABLE_ERROR_CODES } from "./constants";
import type { RemoteErrorType, TypedRemoteError } from "./types";

export function createTypedError(input: {
  type: RemoteErrorType;
  message: string;
  status?: number;
  code?: string;
  reqId?: string | null;
  phase?: string;
  url?: string;
  details?: unknown;
  originalError?: unknown;
}): TypedRemoteError {
  const error = new Error(input.message) as TypedRemoteError;
  error.type = input.type;
  error.status = input.status;
  error.code = input.code;
  error.reqId = input.reqId;
  error.phase = input.phase;
  error.url = input.url;
  error.details = input.details;
  error.originalError = input.originalError;
  return error;
}

export function classifyError(
  inputError: unknown,
  context: {
    reqId?: string | null;
    phase?: string;
    url?: string;
    fallbackType?: RemoteErrorType;
  } = {}
): TypedRemoteError {
  if (inputError && typeof inputError === "object" && "type" in inputError && "message" in inputError) {
    return inputError as TypedRemoteError;
  }

  const error = inputError as {
    message?: string;
    code?: string;
    response?: { status?: number };
  };
  const message = typeof error?.message === "string" ? error.message : "unknown remote error";
  const status = error?.response?.status;
  const code = error?.code;

  const lowerMessage = message.toLowerCase();
  const isTimeout = code === "ECONNABORTED"
    || code === "ETIMEDOUT"
    || lowerMessage.includes("timeout");

  let type: RemoteErrorType = context.fallbackType ?? "server_error";
  if (typeof status === "number" && status >= 400 && status < 500) {
    type = "request_error";
  } else if (typeof status === "number" && status >= 500) {
    type = "server_error";
  } else if (isTimeout) {
    type = "timeout";
  }

  return createTypedError({
    type,
    message,
    status,
    code,
    reqId: context.reqId,
    phase: context.phase,
    url: context.url,
    originalError: inputError,
  });
}

export function shouldRetryError(
  inputError: unknown,
  retryCount: number,
  maxRetries: number
): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }

  const error = inputError as {
    code?: string;
    message?: string;
    response?: { status?: number };
  };

  if (typeof error?.response?.status === "number" && error.response.status >= 500) {
    return true;
  }

  if (typeof error?.code === "string" && RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }

  if (typeof error?.message === "string" && error.message.toLowerCase().includes("timeout")) {
    return true;
  }

  return false;
}
