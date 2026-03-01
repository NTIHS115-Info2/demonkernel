import pluginsManager from "./core/pluginsManager";
import { createKernelLogger, shutdownKernelLogger } from "./core/logger";
import type { OnlineMethod, OnlineOptions } from "./core/plugin-sdk";

type CliArgs = {
  plugin?: string;
  options: OnlineOptions;
};

const startupLogger = createKernelLogger("kernel-startup", {
  component: "entrypoint",
});

function parseCliArgs(argv: string[]): CliArgs {
  const options: Record<string, unknown> = {
    method: "local",
  };
  let plugin: string | undefined;

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

  return {
    plugin,
    options: {
      ...options,
      method: (options.method as OnlineMethod) ?? "local",
    } as OnlineOptions,
  };
}

function printStartupReport(report: ReturnType<typeof pluginsManager.getStartupReport>): void {
  if (report.started.length > 0) {
    startupLogger.info(`[start] started plugins: ${report.started.join(", ")}`);
  }

  if (report.skipped.length > 0) {
    startupLogger.info(`[start] skipped plugins: ${report.skipped.join(", ")}`);
  }

  for (const failure of report.failed) {
    startupLogger.error(`[start] failed ${failure.key}: ${failure.reason}`);
  }

  for (const blocked of report.blocked) {
    startupLogger.error(`[start] blocked ${blocked.key}: ${blocked.reason}`);
  }

  for (const cycle of report.cycles) {
    startupLogger.error(`[start] cycle detected: ${cycle.join(" -> ")}`);
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
    const result = await pluginsManager.online(cli.plugin, {
      onlineOptions: cli.options,
    });

    if (!result.ok) {
      throw new Error(`online failed for ${result.key}: ${result.error ?? "unknown error"}`);
    }

    startupLogger.info(`[start] plugin online ok: ${result.key}`);
  } else {
    const report = await pluginsManager.onlineAll({
      defaultOnlineOptions: cli.options,
    });

    printStartupReport(report);

    if (report.failed.length > 0 || report.blocked.length > 0) {
      throw new Error("some plugins failed or were blocked during startup");
    }

    startupLogger.info("[start] all plugins online");
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
