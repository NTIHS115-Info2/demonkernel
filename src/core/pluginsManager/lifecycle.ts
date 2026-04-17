/* 註解：插件 lifecycle 載入與 online/offline/restart/send/state 執行封裝。 */
import type { IPlugin, OnlineOptions, SendOptions, StateCode } from "../plugin-sdk";
import { validateOnlineOptions } from "../plugin-sdk";

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
  logger?.info(message, {
    stage: "lifecycle",
    ...meta,
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
}): Promise<LifecycleActionResult> {
  const pluginKey = params.handle.descriptor.key;
  logLifecycle(params.logger, "plugin online lifecycle begin", {
    action: "online.begin",
    pluginKey,
  });
  const options = resolveOnlineOptions(params.handle.descriptor, params.command?.onlineOptions);
  logLifecycle(params.logger, "plugin online lifecycle options resolved", {
    action: "online.options",
    pluginKey,
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
    result: "ok",
    state: params.runtime.state,
    method: options.method,
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
}): Promise<LifecycleActionResult> {
  const pluginKey = params.handle.descriptor.key;
  logLifecycle(params.logger, "plugin offline lifecycle begin", {
    action: "offline.begin",
    pluginKey,
    previousState: params.runtime.state,
  });
  if (params.runtime.state === "offline") {
    logLifecycle(params.logger, "plugin offline lifecycle skipped", {
      action: "offline.skip",
      pluginKey,
      result: "already-offline",
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
    result: "ok",
    state: params.runtime.state,
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
}): Promise<LifecycleActionResult> {
  const pluginKey = params.handle.descriptor.key;
  logLifecycle(params.logger, "plugin restart lifecycle begin", {
    action: "restart.begin",
    pluginKey,
  });
  const options = resolveOnlineOptions(params.handle.descriptor, params.command?.onlineOptions);
  logLifecycle(params.logger, "plugin restart lifecycle options resolved", {
    action: "restart.options",
    pluginKey,
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
    result: "ok",
    state: params.runtime.state,
    method: options.method,
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
}): Promise<LifecycleActionResult<unknown>> {
  const pluginKey = params.handle.descriptor.key;
  logLifecycle(params.logger, "plugin send lifecycle begin", {
    action: "send.begin",
    pluginKey,
    payload: params.command.payload,
  });
  const value = await params.handle.module.send(params.command.payload as SendOptions);

  params.runtime.lastError = null;
  logLifecycle(params.logger, "plugin send lifecycle success", {
    action: "send.success",
    pluginKey,
    result: "ok",
    state: params.runtime.state,
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
}): Promise<StateCode> {
  const pluginKey = params.handle.descriptor.key;
  logLifecycle(params.logger, "plugin state lifecycle begin", {
    action: "state.begin",
    pluginKey,
  });
  const result = await params.handle.module.state();
  params.runtime.lastStateCode = result.status;
  logLifecycle(params.logger, "plugin state lifecycle success", {
    action: "state.success",
    pluginKey,
    result: "ok",
    pluginState: result.status,
  });
  return result.status;
}

