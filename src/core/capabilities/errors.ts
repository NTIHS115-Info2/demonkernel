export const CapabilitiesErrorCode = {
  INVALID_DECLARATION: "INVALID_DECLARATION",
  INVALID_CAPABILITY: "INVALID_CAPABILITY",
  INVALID_SCHEMA: "INVALID_SCHEMA",
  UNKNOWN_DEFAULT_CAPABILITY: "UNKNOWN_DEFAULT_CAPABILITY",
  CAPABILITY_CONFLICT: "CAPABILITY_CONFLICT",
  UNSUPPORTED_PLUGIN_TYPE: "UNSUPPORTED_PLUGIN_TYPE",
  DUPLICATE_CAPABILITY_ID: "DUPLICATE_CAPABILITY_ID",
} as const;

export type CapabilitiesErrorCodeKey = keyof typeof CapabilitiesErrorCode;

export class CapabilitiesError extends Error {
  code: CapabilitiesErrorCodeKey;
  cause?: unknown;

  constructor(code: CapabilitiesErrorCodeKey, message: string, cause?: unknown) {
    super(message);
    this.name = "CapabilitiesError";
    this.code = code;
    this.cause = cause;
  }
}
