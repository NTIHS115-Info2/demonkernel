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
  startupLogger.info("core plugin online begin", {
    stage: "startup",
    action: "plugin-online.begin",
    pluginKey: ref,
    onlineOptions,
  });
  const beginAt = Date.now();
  const result = await pluginsManager.online(ref, { onlineOptions });
  if (!result.ok) {
    startupLogger.error("core plugin online failed", {
      stage: "startup",
      action: "plugin-online.error",
      pluginKey: ref,
      result: "failed",
      durationMs: Date.now() - beginAt,
      error: result.error ?? "unknown error",
    });
    throw new Error(`online failed for ${result.key}: ${result.error ?? "unknown error"}`);
  }
  startupLogger.info("core plugin online complete", {
    stage: "startup",
    action: "plugin-online.complete",
    pluginKey: ref,
    result: "ok",
    durationMs: Date.now() - beginAt,
    state: result.state,
  });
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  startupLogger.info("kernel startup begin", {
    stage: "startup",
    action: "run.begin",
    argv,
  });
  const cli = parseCliArgs(argv);
  startupLogger.info("kernel cli args parsed", {
    stage: "startup",
    action: "cli.parsed",
    plugin: cli.plugin ?? null,
    options: cli.options,
    llmBaseUrl: cli.llmBaseUrl,
    llmModel: cli.llmModel,
    talkRelayEnabled: cli.talkRelayEnabled,
    talkRelayErrorReply: cli.talkRelayErrorReply,
  });

  const summary = pluginsManager.discoverPlugins();
  startupLogger.info("kernel plugin discovery complete", {
    stage: "startup",
    action: "discover.complete",
    result: "ok",
    summary,
  });
  if (summary.registered === 0) {
    throw new Error("no plugins discovered under dist/skillPlugins and dist/systemPlugins");
  }

  const dependencyValidation = pluginsManager.validateDependencies();
  startupLogger.info("kernel dependency validation complete", {
    stage: "startup",
    action: "dependencies.validate.complete",
    result: dependencyValidation.ok ? "ok" : "warn",
    errors: dependencyValidation.errors,
  });
  if (!dependencyValidation.ok) {
    for (const message of dependencyValidation.errors) {
      startupLogger.warn(`[start] dependency validation warning: ${message}`);
    }
  }

  if (cli.plugin) {
    await onlineRequiredPlugin(cli.plugin, cli.options);
    startupLogger.info("kernel single plugin online complete", {
      stage: "startup",
      action: "single-plugin.complete",
      pluginKey: cli.plugin,
      result: "ok",
    });
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

      await onlineRequiredPlugin("system:conversation-history", { method: "local" });
      startedPlugins.push("system:conversation-history");

      await onlineRequiredPlugin("system:system-prompt-manager", { method: "local" });
      startedPlugins.push("system:system-prompt-manager");

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
      startupLogger.error("kernel core startup failed; rollback begin", {
        stage: "startup",
        action: "core-flow.error",
        result: "failed",
        startedPlugins,
        error: error instanceof Error ? error.message : String(error),
      });
      if (startedPlugins.length > 0) {
        await pluginsManager.offlineAll();
        startupLogger.info("kernel rollback offlineAll complete", {
          stage: "startup",
          action: "core-flow.rollback",
          result: "ok",
          startedPlugins,
        });
      }
      throw error;
    }

    startupLogger.info("kernel core flow online complete", {
      stage: "startup",
      action: "core-flow.complete",
      result: "ok",
      startedPlugins,
    });
  }

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    startupLogger.info("kernel shutdown begin", {
      stage: "shutdown",
      action: "shutdown.begin",
      signalHandled: true,
    });
    const results = await pluginsManager.offlineAll();
    startupLogger.info("kernel shutdown offlineAll complete", {
      stage: "shutdown",
      action: "shutdown.offline-all.complete",
      results,
      result: results.every((item) => item.ok) ? "ok" : "failed",
    });

    for (const result of results) {
      if (!result.ok) {
        startupLogger.error("kernel shutdown plugin offline failed", {
          stage: "shutdown",
          action: "shutdown.plugin-offline.error",
          pluginKey: result.key,
          result: "failed",
          error: result.error ?? "unknown error",
        });
      }
    }

    startupLogger.info("kernel logger shutdown begin", {
      stage: "shutdown",
      action: "shutdown.logger.begin",
    });
    startupLogger.info("kernel shutdown process exit", {
      stage: "shutdown",
      action: "shutdown.exit",
      result: "ok",
    });
    await shutdownKernelLogger();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    startupLogger.info("kernel signal received", {
      stage: "shutdown",
      action: "signal.received",
      signal: "SIGINT",
    });
    void shutdown();
  });

  process.on("SIGTERM", () => {
    startupLogger.info("kernel signal received", {
      stage: "shutdown",
      action: "signal.received",
      signal: "SIGTERM",
    });
    void shutdown();
  });
}

if (require.main === module) {
  run().catch((error) => {
    startupLogger.error("kernel startup fatal error", {
      stage: "startup",
      action: "run.fatal",
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
