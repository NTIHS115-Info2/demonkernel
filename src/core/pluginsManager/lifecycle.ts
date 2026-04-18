/* 註解：插件 lifecycle 載入與 online/offline/restart/send/state 執行封裝。 */
import type { IPlugin, OnlineOptions, SendOptions, StateCode } from "../plugin-sdk";
import { validateOnlineOptions } from "../plugin-sdk";
import {
  createObservabilityRequestId,
  summarizeUnknown,
  withObservability,
} from "../logger/observability";

import { PluginsManagerError } from "./errors";
import type {
  LifecycleActionResult,
  ManagerLogger,
  OnlineCommandOptions,
  PluginDescriptor,
  PluginHandle,
  PluginRuntime,
  SendCommandOptions,
} from "./types";

function logLifecycle(
  logger: ManagerLogger | undefined,
  message: string,
  meta: Record<string, unknown>
): void {
  const hasObservability =
    typeof meta.observability === "object"
    && meta.observability !== null
    && !Array.isArray(meta.observability);
  logger?.info(
    message,
    withObservability(
      {
        stage: "lifecycle",
        ...meta,
      },
      hasObservability
        ? (meta.observability as {
            kind: "node" | "raw";
            requestId?: string;
            eventType?: string;
            outcome?: "success" | "error" | "abort" | "timeout";
          })
        : { kind: "node" }
    )
  );
}

function logLifecycleRaw(
  logger: ManagerLogger | undefined,
  message: string,
  requestId: string,
  eventType: string,
  meta: Record<string, unknown>
): void {
  logger?.info(
    message,
    withObservability(
      {
        stage: "lifecycle",
        ...meta,
      },
      {
        kind: "raw",
        requestId,
        eventType,
      }
    )
  );
}

function createLifecycleRequestId(pluginKey: string, scope: string, requestId?: string | null): string {
  return createObservabilityRequestId(`plugins-manager:${scope}`, {
    requestId,
    conversationId: pluginKey,
  });
}

function assertLifecycleContract(module: IPlugin, descriptor: PluginDescriptor): void {
  const required: Array<keyof IPlugin> = ["online", "offline", "restart", "state", "send"];

  for (const method of required) {
    if (typeof module[method] !== "function") {
      throw new PluginsManagerError(
        "LIFECYCLE_CONTRACT_INVALID",
        `plugin ${descriptor.key} missing lifecycle method: ${String(method)}`
      );
    }
  }
}

export function loadPluginHandle(descriptor: PluginDescriptor): PluginHandle {
  let loaded: unknown;

  try {
    loaded = require(descriptor.entryPath);
  } catch (error) {
    throw new PluginsManagerError(
      "MODULE_LOAD_FAILED",
      `failed to require plugin entry: ${descriptor.entryPath}`,
      error
    );
  }

  const module = ((loaded as { default?: unknown })?.default ?? loaded) as IPlugin;
  assertLifecycleContract(module, descriptor);

  return {
    descriptor,
    module,
  };
}

export function resolveOnlineOptions(
  descriptor: PluginDescriptor,
  options?: OnlineOptions
): OnlineOptions {
  const resolvedMethod = options?.method ?? descriptor.manifest.runtime.method[0];
  const resolvedOptions: OnlineOptions = {
    ...options,
    method: resolvedMethod,
  };

  validateOnlineOptions(descriptor.manifest, resolvedOptions);

  return resolvedOptions;
}

export async function runOnlineLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  command?: OnlineCommandOptions;
  logger?: ManagerLogger;
  requestId?: string;
}): Promise<LifecycleActionResult> {
  const pluginKey = params.handle.descriptor.key;
  const requestId = createLifecycleRequestId(pluginKey, "lifecycle-online", params.requestId);
  logLifecycle(params.logger, "plugin online lifecycle begin", {
    action: "online.begin",
    pluginKey,
    requestId,
    observability: {
      kind: "node",
      requestId,
      eventType: "online.begin",
    },
  });
  const options = resolveOnlineOptions(params.handle.descriptor, params.command?.onlineOptions);
  logLifecycle(params.logger, "plugin online lifecycle options resolved", {
    action: "online.options",
    pluginKey,
    requestId,
    onlineOptions: summarizeUnknown(options),
    observability: {
      kind: "node",
      requestId,
      eventType: "online.options",
    },
  });
  logLifecycleRaw(params.logger, "plugin online lifecycle raw options", requestId, "online.options.raw", {
    onlineOptions: options,
  });

  params.runtime.state = "starting";
  await params.handle.module.online(options);

  params.runtime.state = "online";
  params.runtime.lastError = null;
  params.runtime.moduleLoaded = true;
  params.runtime.onlineMethod = options.method;

  logLifecycle(params.logger, "plugin online lifecycle success", {
    action: "online.success",
    pluginKey,
    requestId,
    result: "ok",
    state: params.runtime.state,
    method: options.method,
    observability: {
      kind: "node",
      requestId,
      eventType: "online.complete",
      outcome: "success",
    },
  });
  return {
    key: pluginKey,
    ok: true,
    state: params.runtime.state,
  };
}

export async function runOfflineLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  logger?: ManagerLogger;
  requestId?: string;
}): Promise<LifecycleActionResult> {
  const pluginKey = params.handle.descriptor.key;
  const requestId = createLifecycleRequestId(pluginKey, "lifecycle-offline", params.requestId);
  logLifecycle(params.logger, "plugin offline lifecycle begin", {
    action: "offline.begin",
    pluginKey,
    requestId,
    previousState: params.runtime.state,
    observability: {
      kind: "node",
      requestId,
      eventType: "offline.begin",
    },
  });
  if (params.runtime.state === "offline") {
    logLifecycle(params.logger, "plugin offline lifecycle skipped", {
      action: "offline.skip",
      pluginKey,
      requestId,
      result: "already-offline",
      observability: {
        kind: "node",
        requestId,
        eventType: "offline.complete",
        outcome: "success",
      },
    });
    return {
      key: pluginKey,
      ok: true,
      state: params.runtime.state,
    };
  }

  params.runtime.state = "stopping";
  await params.handle.module.offline();

  params.runtime.state = "offline";
  params.runtime.lastError = null;
  params.runtime.onlineMethod = null;

  logLifecycle(params.logger, "plugin offline lifecycle success", {
    action: "offline.success",
    pluginKey,
    requestId,
    result: "ok",
    state: params.runtime.state,
    observability: {
      kind: "node",
      requestId,
      eventType: "offline.complete",
      outcome: "success",
    },
  });
  return {
    key: pluginKey,
    ok: true,
    state: params.runtime.state,
  };
}

export async function runRestartLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  command?: OnlineCommandOptions;
  logger?: ManagerLogger;
  requestId?: string;
}): Promise<LifecycleActionResult> {
  const pluginKey = params.handle.descriptor.key;
  const requestId = createLifecycleRequestId(pluginKey, "lifecycle-restart", params.requestId);
  logLifecycle(params.logger, "plugin restart lifecycle begin", {
    action: "restart.begin",
    pluginKey,
    requestId,
    observability: {
      kind: "node",
      requestId,
      eventType: "restart.begin",
    },
  });
  const options = resolveOnlineOptions(params.handle.descriptor, params.command?.onlineOptions);
  logLifecycle(params.logger, "plugin restart lifecycle options resolved", {
    action: "restart.options",
    pluginKey,
    requestId,
    onlineOptions: summarizeUnknown(options),
    observability: {
      kind: "node",
      requestId,
      eventType: "restart.options",
    },
  });
  logLifecycleRaw(params.logger, "plugin restart lifecycle raw options", requestId, "restart.options.raw", {
    onlineOptions: options,
  });

  params.runtime.state = "stopping";
  await params.handle.module.restart(options);

  params.runtime.state = "online";
  params.runtime.lastError = null;
  params.runtime.moduleLoaded = true;
  params.runtime.onlineMethod = options.method;

  logLifecycle(params.logger, "plugin restart lifecycle success", {
    action: "restart.success",
    pluginKey,
    requestId,
    result: "ok",
    state: params.runtime.state,
    method: options.method,
    observability: {
      kind: "node",
      requestId,
      eventType: "restart.complete",
      outcome: "success",
    },
  });
  return {
    key: pluginKey,
    ok: true,
    state: params.runtime.state,
  };
}

export async function runSendLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  command: SendCommandOptions;
  logger?: ManagerLogger;
  requestId?: string;
}): Promise<LifecycleActionResult<unknown>> {
  const pluginKey = params.handle.descriptor.key;
  const requestId = createLifecycleRequestId(pluginKey, "lifecycle-send", params.requestId);
  logLifecycle(params.logger, "plugin send lifecycle begin", {
    action: "send.begin",
    pluginKey,
    requestId,
    payload: summarizeUnknown(params.command.payload),
    observability: {
      kind: "node",
      requestId,
      eventType: "send.begin",
    },
  });
  logLifecycleRaw(params.logger, "plugin send lifecycle raw payload", requestId, "send.payload.raw", {
    payload: params.command.payload,
  });
  const value = await params.handle.module.send(params.command.payload as SendOptions);

  params.runtime.lastError = null;
  logLifecycle(params.logger, "plugin send lifecycle success", {
    action: "send.success",
    pluginKey,
    requestId,
    result: "ok",
    state: params.runtime.state,
    value: summarizeUnknown(value),
    observability: {
      kind: "node",
      requestId,
      eventType: "send.complete",
      outcome: "success",
    },
  });
  logLifecycleRaw(params.logger, "plugin send lifecycle raw value", requestId, "send.value.raw", {
    value,
  });

  return {
    key: pluginKey,
    ok: true,
    state: params.runtime.state,
    value,
  };
}

export async function runStateLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  logger?: ManagerLogger;
  requestId?: string;
}): Promise<StateCode> {
  const pluginKey = params.handle.descriptor.key;
  const requestId = createLifecycleRequestId(pluginKey, "lifecycle-state", params.requestId);
  logLifecycle(params.logger, "plugin state lifecycle begin", {
    action: "state.begin",
    pluginKey,
    requestId,
    observability: {
      kind: "node",
      requestId,
      eventType: "state.begin",
    },
  });
  const result = await params.handle.module.state();
  params.runtime.lastStateCode = result.status;
  logLifecycle(params.logger, "plugin state lifecycle success", {
    action: "state.success",
    pluginKey,
    requestId,
    result: "ok",
    pluginState: result.status,
    observability: {
      kind: "node",
      requestId,
      eventType: "state.complete",
      outcome: "success",
    },
  });
  return result.status;
}

