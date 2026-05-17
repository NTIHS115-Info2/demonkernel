type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

type ObservabilityKind = "node" | "raw";
type ObservabilityOutcome = "success" | "error" | "abort" | "timeout";

export type LoggerObservabilityOptions = {
  diagnosticRingSize?: number;
  diagnosticPreviewChars?: number;
  rawDirectExport?: boolean;
};

export type LoggerObservabilityMeta = {
  kind: ObservabilityKind;
  requestId?: string;
  eventType?: string;
  outcome?: ObservabilityOutcome;
};

type LoggerOptions = {
  rootDir?: string;
  level?: LogLevel;
  redact?: boolean;
  redactionPatterns?: RegExp[];
  observability?: LoggerObservabilityOptions;
  console?: {
    enabled?: boolean;
    level?: LogLevel;
    levels?: LogLevel[];
  };
};

export interface KernelLogger {
  trace(message: unknown, meta?: Record<string, unknown>): void;
  debug(message: unknown, meta?: Record<string, unknown>): void;
  info(message: unknown, meta?: Record<string, unknown>): void;
  warn(message: unknown, meta?: Record<string, unknown>): void;
  error(message: unknown, meta?: Record<string, unknown>): void;
  fatal(message: unknown, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): KernelLogger;
  isLevelEnabled(level: LogLevel): boolean;
}

type LoggerRuntime = {
  configureLogger: (options?: LoggerOptions) => void;
  getLogger: (name: string, bindings?: Record<string, unknown>) => KernelLogger;
  flushLogs: () => Promise<void>;
  shutdownLogger: () => Promise<void>;
};

const loggerRuntime = require("../../../tools/logger") as LoggerRuntime;

export function configureKernelLogger(options?: LoggerOptions): void {
  loggerRuntime.configureLogger(options);
}

export function createKernelLogger(
  name: string,
  bindings: Record<string, unknown> = {}
): KernelLogger {
  return loggerRuntime.getLogger(name, bindings);
}

export async function flushKernelLogs(): Promise<void> {
  await loggerRuntime.flushLogs();
}

export async function shutdownKernelLogger(): Promise<void> {
  await loggerRuntime.shutdownLogger();
}

