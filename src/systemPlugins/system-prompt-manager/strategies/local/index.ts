import fs from "node:fs/promises";
import path from "node:path";

import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "../../../../core/plugin-sdk";
import { createKernelLogger } from "../../../../core/logger";

import type {
  SystemPromptGetInput,
  SystemPromptOnlineOptions,
  SystemPromptSendInput,
} from "./types";

const METHOD_LOCAL = "local";
const PROMPT_FILE_SUFFIX = ".system.prompt.md";
const DEFAULT_PROMPT_STATE = "default";
export const EMERGENCY_SYSTEM_PROMPT = "Respond to the user request.";

const defaultPromptDir = path.resolve(__dirname, "../../assets/prompts");

const logger = createKernelLogger("plugin-system-prompt-manager-local", {
  plugin: "system-prompt-manager",
  type: "system",
  strategy: "local",
});

let online = false;
let promptDir = defaultPromptDir;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertLocalMethod(method: unknown, operation: string): void {
  if (method !== undefined && method !== METHOD_LOCAL) {
    throw new Error(`${operation} requires method="local"`);
  }
}

function ensureOnline(): void {
  if (!online) {
    throw new Error("system-prompt-manager local strategy is not online");
  }
}

function normalizeState(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function resolvePromptFilePath(state: string): string | null {
  const resolvedPromptDir = path.resolve(promptDir);
  const filePath = path.resolve(resolvedPromptDir, `${state}${PROMPT_FILE_SUFFIX}`);
  const relativePath = path.relative(resolvedPromptDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return filePath;
}

async function readPromptFile(filePath: string, state: string, promptKind: "requested" | "default"): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      logger.warn("system prompt file is empty", {
        state,
        filePath,
        promptKind,
      });
      return null;
    }
    return trimmed;
  } catch (error) {
    logger.warn("system prompt file read failed", {
      state,
      filePath,
      promptKind,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readDefaultPrompt(reason: Record<string, unknown>): Promise<string> {
  const filePath = resolvePromptFilePath(DEFAULT_PROMPT_STATE);
  if (!filePath) {
    logger.warn("default system prompt file path is invalid, using emergency prompt", {
      ...reason,
      state: DEFAULT_PROMPT_STATE,
      promptDir,
    });
    return EMERGENCY_SYSTEM_PROMPT;
  }

  const prompt = await readPromptFile(filePath, DEFAULT_PROMPT_STATE, "default");
  if (prompt !== null) {
    return prompt;
  }

  logger.warn("default system prompt file unavailable, using emergency prompt", {
    ...reason,
    state: DEFAULT_PROMPT_STATE,
    filePath,
  });
  return EMERGENCY_SYSTEM_PROMPT;
}

export default {
  method: METHOD_LOCAL,

  async online(options: StrategyOnlineOptions): Promise<void> {
    const typedOptions = (isRecord(options) ? options : {}) as SystemPromptOnlineOptions;
    assertLocalMethod(typedOptions.method ?? METHOD_LOCAL, "online");
    promptDir = path.resolve(normalizeOptionalString(typedOptions.promptDir) ?? defaultPromptDir);
    online = true;
    logger.info("system-prompt-manager online", {
      promptDir,
    });
  },

  async offline(): Promise<void> {
    online = false;
    promptDir = defaultPromptDir;
    logger.info("system-prompt-manager offline");
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async getSystemPrompt(input: SystemPromptGetInput): Promise<string> {
    ensureOnline();
    const state = normalizeState(isRecord(input) ? input.state : undefined);
    if (!state) {
      logger.warn("system prompt state is missing, using default prompt", {
        state: isRecord(input) ? input.state : undefined,
      });
      return readDefaultPrompt({ reason: "missing-state" });
    }

    const filePath = resolvePromptFilePath(state);
    if (!filePath) {
      logger.warn("system prompt state resolved outside prompt directory, using default prompt", {
        state,
        promptDir,
      });
      return readDefaultPrompt({ reason: "unsafe-state", requestedState: state });
    }

    const prompt = await readPromptFile(filePath, state, "requested");
    if (prompt !== null) {
      return prompt;
    }
    return readDefaultPrompt({ reason: "requested-prompt-unavailable", requestedState: state });
  },

  async send(options: SendOptions): Promise<unknown> {
    ensureOnline();
    const input = (isRecord(options) ? options : {}) as SystemPromptSendInput;
    const action = normalizeOptionalString(input.action);
    if (action && action !== "system.prompt.manager.get") {
      throw new Error(`unsupported action: ${String(input.action)}`);
    }
    return this.getSystemPrompt(input);
  },
};
