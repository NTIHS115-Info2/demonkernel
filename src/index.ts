import pluginsManager from "./core/pluginsManager";
import { createKernelLogger, shutdownKernelLogger } from "./core/logger";
import type { OnlineMethod, OnlineOptions } from "./core/plugin-sdk";

type CliArgs = {
  plugin?: string;
  options: OnlineOptions;
  llmBaseUrl: string | null;
  llmModel: string | null;
  talkRelayEnabled: boolean;
  talkRelayErrorReply: string | null;
};

const startupLogger = createKernelLogger("kernel-startup", {
  component: "entrypoint",
});

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBooleanValue(value: unknown, fieldName: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  throw new Error(`${fieldName} must be boolean-like (true/false/1/0/yes/no)`);
}

function parseCliArgs(argv: string[]): CliArgs {
  const options: Record<string, unknown> = {
    method: "local",
  };
  let plugin: string | undefined;
  let llmBaseUrlFromCli: string | null = null;
  let llmModelFromCli: string | null = null;
  let talkRelayEnabledFromCli: boolean | null = null;
  let talkRelayErrorReplyFromCli: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--plugin" && next) {
      plugin = next;
      i += 1;
      continue;
    }

    if (arg === "--method" && next) {
      options.method = next;
      i += 1;
      continue;
    }

    if (arg === "--url" && next) {
      options.url = next;
      options.baseUrl = next;
      llmBaseUrlFromCli = normalizeOptionalString(next);
      i += 1;
      continue;
    }

    if (arg === "--llm-base-url" && next) {
      options.baseUrl = next;
      llmBaseUrlFromCli = normalizeOptionalString(next);
      i += 1;
      continue;
    }

    if (arg === "--llm-model" && next) {
      options.model = next;
      llmModelFromCli = normalizeOptionalString(next);
      i += 1;
      continue;
    }

    if (arg === "--talk-relay-enabled" && next) {
      const parsed = parseBooleanValue(next, "--talk-relay-enabled");
      options.relayEnabled = parsed;
      talkRelayEnabledFromCli = parsed;
      i += 1;
      continue;
    }

    if (arg === "--talk-relay-error-reply" && next) {
      options.relayErrorReply = next;
      talkRelayErrorReplyFromCli = normalizeOptionalString(next);
      i += 1;
      continue;
    }

    if (arg === "--token" && next) {
      options.token = next;
      i += 1;
      continue;
    }

    if (arg === "--path" && next) {
      options.path = next;
      i += 1;
      continue;
    }
  }

  const llmBaseUrl = llmBaseUrlFromCli ?? normalizeOptionalString(process.env.LLM_REMOTE_BASE_URL);
  const llmModel = llmModelFromCli ?? normalizeOptionalString(process.env.LLM_REMOTE_MODEL);
  const talkRelayEnabled = talkRelayEnabledFromCli
    ?? parseBooleanValue(process.env.TALK_RELAY_ENABLED ?? "true", "TALK_RELAY_ENABLED");
  const talkRelayErrorReply = talkRelayErrorReplyFromCli
    ?? normalizeOptionalString(process.env.TALK_RELAY_ERROR_REPLY);

  if (llmModel) {
    options.model = llmModel;
  }
  options.relayEnabled = talkRelayEnabled;
  if (talkRelayErrorReply) {
    options.relayErrorReply = talkRelayErrorReply;
  }

  return {
    plugin,
    options: {
      ...options,
      method: (options.method as OnlineMethod) ?? "local",
    } as OnlineOptions,
    llmBaseUrl,
    llmModel,
    talkRelayEnabled,
    talkRelayErrorReply,
  };
}

async function onlineRequiredPlugin(ref: string, onlineOptions: OnlineOptions): Promise<void> {
  const result = await pluginsManager.online(ref, { onlineOptions });
  if (!result.ok) {
    throw new Error(`online failed for ${result.key}: ${result.error ?? "unknown error"}`);
  }
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const cli = parseCliArgs(argv);

  const summary = pluginsManager.discoverPlugins();
  if (summary.registered === 0) {
    throw new Error("no plugins discovered under dist/skillPlugins and dist/systemPlugins");
  }

  const dependencyValidation = pluginsManager.validateDependencies();
  if (!dependencyValidation.ok) {
    for (const message of dependencyValidation.errors) {
      startupLogger.warn(`[start] dependency validation warning: ${message}`);
    }
  }

  if (cli.plugin) {
    await onlineRequiredPlugin(cli.plugin, cli.options);
    startupLogger.info(`[start] plugin online ok: ${cli.plugin}`);
  } else {
    if (!cli.llmBaseUrl) {
      throw new Error(
        "LLM remote baseUrl is required for core startup. Use --llm-base-url or LLM_REMOTE_BASE_URL."
      );
    }

    const startedPlugins: string[] = [];

    try {
      const llmOptions: OnlineOptions = {
        method: "remote",
        baseUrl: cli.llmBaseUrl,
      };
      if (cli.llmModel) {
        llmOptions.model = cli.llmModel;
      }

      await onlineRequiredPlugin("system:llm-remote-gateway", llmOptions);
      startedPlugins.push("system:llm-remote-gateway");

      await onlineRequiredPlugin("system:discord", { method: "local" });
      startedPlugins.push("system:discord");

      const talkEngineOptions: OnlineOptions = {
        method: "local",
        relayEnabled: cli.talkRelayEnabled,
      };
      if (cli.talkRelayErrorReply) {
        talkEngineOptions.relayErrorReply = cli.talkRelayErrorReply;
      }

      await onlineRequiredPlugin("system:talk-engine", talkEngineOptions);
      startedPlugins.push("system:talk-engine");
    } catch (error) {
      if (startedPlugins.length > 0) {
        await pluginsManager.offlineAll();
      }
      throw error;
    }

    startupLogger.info(`[start] core flow online: ${startedPlugins.join(", ")}`);
  }

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    startupLogger.info("[start] shutting down...");
    const results = await pluginsManager.offlineAll();

    for (const result of results) {
      if (!result.ok) {
        startupLogger.error(
          `[start] offline failed for ${result.key}: ${result.error ?? "unknown error"}`
        );
      }
    }

    await shutdownKernelLogger();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

if (require.main === module) {
  run().catch((error) => {
    startupLogger.error("[start] fatal:", {
      error: error instanceof Error ? error.message : String(error),
    });
    shutdownKernelLogger()
      .catch(() => undefined)
      .finally(() => {
        process.exit(1);
      });
  });
}

export { parseCliArgs };
