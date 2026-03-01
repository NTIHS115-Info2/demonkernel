/* 註解：插件 lifecycle 載入與 online/offline/restart/send/state 執行封裝。 */
import type { IPlugin, OnlineOptions, SendOptions, StateCode } from "../plugin-sdk";
import { validateOnlineOptions } from "../plugin-sdk";

import { PluginsManagerError } from "./errors";
import type {
  LifecycleActionResult,
  OnlineCommandOptions,
  PluginDescriptor,
  PluginHandle,
  PluginRuntime,
  SendCommandOptions,
} from "./types";

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
}): Promise<LifecycleActionResult> {
  const options = resolveOnlineOptions(params.handle.descriptor, params.command?.onlineOptions);

  params.runtime.state = "starting";
  await params.handle.module.online(options);

  params.runtime.state = "online";
  params.runtime.lastError = null;
  params.runtime.moduleLoaded = true;
  params.runtime.onlineMethod = options.method;

  return {
    key: params.handle.descriptor.key,
    ok: true,
    state: params.runtime.state,
  };
}

export async function runOfflineLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
}): Promise<LifecycleActionResult> {
  if (params.runtime.state === "offline") {
    return {
      key: params.handle.descriptor.key,
      ok: true,
      state: params.runtime.state,
    };
  }

  params.runtime.state = "stopping";
  await params.handle.module.offline();

  params.runtime.state = "offline";
  params.runtime.lastError = null;
  params.runtime.onlineMethod = null;

  return {
    key: params.handle.descriptor.key,
    ok: true,
    state: params.runtime.state,
  };
}

export async function runRestartLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  command?: OnlineCommandOptions;
}): Promise<LifecycleActionResult> {
  const options = resolveOnlineOptions(params.handle.descriptor, params.command?.onlineOptions);

  params.runtime.state = "stopping";
  await params.handle.module.restart(options);

  params.runtime.state = "online";
  params.runtime.lastError = null;
  params.runtime.moduleLoaded = true;
  params.runtime.onlineMethod = options.method;

  return {
    key: params.handle.descriptor.key,
    ok: true,
    state: params.runtime.state,
  };
}

export async function runSendLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
  command: SendCommandOptions;
}): Promise<LifecycleActionResult<unknown>> {
  const value = await params.handle.module.send(params.command.payload as SendOptions);

  params.runtime.lastError = null;

  return {
    key: params.handle.descriptor.key,
    ok: true,
    state: params.runtime.state,
    value,
  };
}

export async function runStateLifecycle(params: {
  handle: PluginHandle;
  runtime: PluginRuntime;
}): Promise<StateCode> {
  const result = await params.handle.module.state();
  params.runtime.lastStateCode = result.status;
  return result.status;
}

