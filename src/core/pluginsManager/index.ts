import type {
  CapabilityBinding,
  CapabilityProviderInstance,
  IPlugin,
  OnlineOptions,
  PluginType,
  SendOptions,
} from "../plugin-sdk";
import { createKernelLogger } from "../logger";
import {
  createObservabilityRequestId,
  summarizeUnknown,
  withObservability,
} from "../logger/observability";
import { CapabilitiesManager } from "../capabilities";
import defaultCapabilityRegistry, { CapabilityRegistry } from "../registry";

import {
  PluginsManagerError,
  PluginsManagerErrorCode,
  toErrorMessage,
} from "./errors";
import {
  loadPluginHandle,
  runOfflineLifecycle,
  runOnlineLifecycle,
  runRestartLifecycle,
  runSendLifecycle,
  runStateLifecycle,
} from "./lifecycle";
import {
  buildScanSummary,
  createDefaultPluginPaths,
  createPluginKey,
  discoverPluginsInDirectory,
  normalizePluginName,
} from "./registry";
import { analyzeDependencyGraph, evaluateDependencyStatus } from "./dependency";
import type {
  LifecycleActionResult,
  ManagerLogger,
  OnlineCommandOptions,
  PluginDescriptor,
  PluginHandle,
  PluginKey,
  PluginRef,
  PluginRuntime,
  PluginRuntimeSnapshot,
  PluginsManagerOptions,
  RegistrySnapshotItem,
  ScanSummary,
  SendCommandOptions,
  StartupFailure,
  StartupOptions,
  StartupReport,
  StateResult,
} from "./types";

const defaultLogger: ManagerLogger = createKernelLogger("plugins-manager");

function toErrorMessageSafe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function initializeRuntime(): PluginRuntime {
  return {
    state: "offline",
    lastError: null,
    lastStateCode: null,
    moduleLoaded: false,
    onlineMethod: null,
  };
}

function parseKeyFromRef(ref: PluginRef): PluginKey | null {
  if (typeof ref !== "string") {
    return null;
  }

  const normalized = ref.trim().toLowerCase();
  if (!normalized.includes(":")) {
    return null;
  }

  const [type, name] = normalized.split(":");
  if ((type !== "skill" && type !== "system") || !name) {
    return null;
  }

  return `${type}:${name}` as PluginKey;
}

function toFailure(key: PluginKey, reason: string): StartupFailure {
  return {
    key,
    reason,
  };
}

function ensureNonEmptyString(
  value: unknown,
  code: keyof typeof PluginsManagerErrorCode,
  message: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PluginsManagerError(code, message);
  }

  return value.trim();
}

export class PluginsManager {
  readonly skillPluginsPath: string;
  readonly systemPluginsPath: string;

  private readonly logger: ManagerLogger;
  private readonly capabilitiesManager: CapabilitiesManager;
  private readonly capabilityRegistry: CapabilityRegistry;
  private readonly registry = new Map<PluginKey, PluginDescriptor>();
  private readonly invalidRegistry = new Map<string, {
    type: PluginType;
    directory: string;
    manifestPath: string;
    reason: string;
    recordedAt: string;
  }>();
  private readonly runtime = new Map<PluginKey, PluginRuntime>();
  private readonly handles = new Map<PluginKey, PluginHandle>();
  private lastStartupReport: StartupReport = {
    requested: [],
    started: [],
    skipped: [],
    failed: [],
    blocked: [],
    cycles: [],
  };

  private logInfo(message: string, meta: Record<string, unknown> = {}): void {
    const hasObservability =
      typeof meta.observability === "object"
      && meta.observability !== null
      && !Array.isArray(meta.observability);
    this.logger.info(
      message,
      withObservability(
        {
          stage: "manager",
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

  private logWarn(message: string, meta: Record<string, unknown> = {}): void {
    const hasObservability =
      typeof meta.observability === "object"
      && meta.observability !== null
      && !Array.isArray(meta.observability);
    this.logger.warn(
      message,
      withObservability(
        {
          stage: "manager",
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

  private logError(message: string, meta: Record<string, unknown> = {}): void {
    const hasObservability =
      typeof meta.observability === "object"
      && meta.observability !== null
      && !Array.isArray(meta.observability);
    this.logger.error(
      message,
      withObservability(
        {
          stage: "manager",
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

  private logRaw(
    message: string,
    requestId: string,
    eventType: string,
    meta: Record<string, unknown> = {}
  ): void {
    this.logger.info(
      message,
      withObservability(
        {
          stage: "manager",
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

  private createManagerRequestId(
    scope: string,
    seed: {
      requestId?: string | null;
      pluginKey?: string | null;
    } = {}
  ): string {
    return createObservabilityRequestId(`plugins-manager:${scope}`, {
      requestId: seed.requestId ?? null,
      conversationId: seed.pluginKey ?? null,
    });
  }

  constructor(options: PluginsManagerOptions = {}) {
    const defaults = createDefaultPluginPaths(__dirname);
    this.skillPluginsPath = options.skillPluginsPath ?? defaults.skillPluginsPath;
    this.systemPluginsPath = options.systemPluginsPath ?? defaults.systemPluginsPath;
    this.logger = options.logger ?? defaultLogger;

    if (options.capabilitiesManager) {
      this.capabilitiesManager = options.capabilitiesManager;
    } else if (options.capabilityRegistry) {
      this.capabilitiesManager = options.capabilityRegistry.getCapabilitiesManagerInternal();
    } else {
      this.capabilitiesManager = new CapabilitiesManager();
    }

    if (options.capabilityRegistry) {
      if (!options.capabilityRegistry.isBoundTo(this.capabilitiesManager)) {
        throw new PluginsManagerError(
          "MANIFEST_INVALID",
          "capabilityRegistry and capabilitiesManager must use the same instance"
        );
      }

      this.capabilityRegistry = options.capabilityRegistry;
    } else {
      this.capabilityRegistry = new CapabilityRegistry({
        capabilitiesManager: this.capabilitiesManager,
      });
    }

    this.logInfo("plugins manager initialized", {
      action: "constructor.init",
      result: "ok",
      skillPluginsPath: this.skillPluginsPath,
      systemPluginsPath: this.systemPluginsPath,
    });
  }

  discoverPlugins(): ScanSummary {
    this.logInfo("discover plugins begin", {
      action: "discover.begin",
      skillPluginsPath: this.skillPluginsPath,
      systemPluginsPath: this.systemPluginsPath,
    });
    const previousRuntime = new Map(this.runtime);
    const previousHandles = new Map(this.handles);

    this.registry.clear();
    this.invalidRegistry.clear();
    this.capabilityRegistry.clearInternal();
    this.capabilitiesManager.reset();

    const skillSummary = discoverPluginsInDirectory(
      "skill",
      this.skillPluginsPath,
      this.registry,
      this.invalidRegistry
    );
    const systemSummary = discoverPluginsInDirectory(
      "system",
      this.systemPluginsPath,
      this.registry,
      this.invalidRegistry,
      this.capabilitiesManager
    );

    const summary = buildScanSummary(skillSummary, systemSummary);

    this.runtime.clear();
    this.handles.clear();

    for (const [key] of this.registry) {
      this.runtime.set(key, previousRuntime.get(key) ?? initializeRuntime());
      const existingHandle = previousHandles.get(key);
      if (existingHandle) {
        this.handles.set(key, existingHandle);
      }
    }

    this.restoreOnlineCapabilityProviders();
    this.logInfo("discover plugins complete", {
      action: "discover.complete",
      result: "ok",
      total: summary.total,
      registered: summary.registered,
      invalid: summary.invalid,
      byType: summary.byType,
      invalidItems: this.getInvalidPlugins(),
    });

    return summary;
  }

  validateDependencies(): { ok: boolean; errors: string[] } {
    this.logInfo("validate dependencies begin", {
      action: "dependencies.validate.begin",
      pluginCount: this.registry.size,
    });
    const errors: string[] = [];

    for (const descriptor of this.registry.values()) {
      for (const [depName, expectedVersion] of Object.entries(descriptor.dependencies.skill)) {
        const dependencyKey = createPluginKey("skill", depName);
        const dependency = this.registry.get(dependencyKey);
        if (!dependency) {
          errors.push(`${descriptor.key} requires missing dependency ${dependencyKey}`);
          continue;
        }
        if (dependency.version !== expectedVersion) {
          errors.push(
            `${descriptor.key} requires ${dependencyKey}@${expectedVersion}, got ${dependency.version}`
          );
        }
      }

      for (const [depName, expectedVersion] of Object.entries(descriptor.dependencies.system)) {
        const dependencyKey = createPluginKey("system", depName);
        const dependency = this.registry.get(dependencyKey);
        if (!dependency) {
          errors.push(`${descriptor.key} requires missing dependency ${dependencyKey}`);
          continue;
        }
        if (dependency.version !== expectedVersion) {
          errors.push(
            `${descriptor.key} requires ${dependencyKey}@${expectedVersion}, got ${dependency.version}`
          );
        }
      }
    }

    const result = {
      ok: errors.length === 0,
      errors,
    };
    this.logInfo("validate dependencies complete", {
      action: "dependencies.validate.complete",
      result: result.ok ? "ok" : "failed",
      errorCount: errors.length,
      errors,
    });
    return result;
  }

  getRegistrySnapshot(): RegistrySnapshotItem[] {
    return Array.from(this.registry.values()).map((descriptor) => ({
      key: descriptor.key,
      type: descriptor.type,
      name: descriptor.name,
      version: descriptor.version,
      startupWeight: descriptor.startupWeight,
      manifestPath: descriptor.manifestPath,
      entryPath: descriptor.entryPath,
      dependencies: {
        skill: { ...descriptor.dependencies.skill },
        system: { ...descriptor.dependencies.system },
      },
    }));
  }

  getInvalidPlugins() {
    return Array.from(this.invalidRegistry.values()).map((entry) => ({ ...entry }));
  }

  getRuntimeStatus(): PluginRuntimeSnapshot[] {
    return Array.from(this.runtime.entries()).map(([key, value]) => ({
      key,
      state: value.state,
      lastError: value.lastError,
      lastStateCode: value.lastStateCode,
      moduleLoaded: value.moduleLoaded,
      onlineMethod: value.onlineMethod,
    }));
  }

  getStartupReport(): StartupReport {
    return {
      requested: [...this.lastStartupReport.requested],
      started: [...this.lastStartupReport.started],
      skipped: [...this.lastStartupReport.skipped],
      failed: this.lastStartupReport.failed.map((item) => ({ ...item })),
      blocked: this.lastStartupReport.blocked.map((item) => ({ ...item })),
      cycles: this.lastStartupReport.cycles.map((cycle) => [...cycle]),
    };
  }

  resolvePluginKey(ref: PluginRef): PluginKey {
    this.logInfo("resolve plugin key begin", {
      action: "resolve-plugin-key.begin",
      ref: String(ref),
    });
    const byKey = parseKeyFromRef(ref);
    if (byKey) {
      if (!this.registry.has(byKey)) {
        this.logWarn("resolve plugin key failed: missing plugin", {
          action: "resolve-plugin-key.failed",
          ref: String(ref),
          pluginKey: byKey,
          result: "failed",
          reason: "plugin_not_found",
        });
        throw new PluginsManagerError(
          "PLUGIN_NOT_FOUND",
          `plugin not found: ${String(ref)}`
        );
      }
      this.logInfo("resolve plugin key complete", {
        action: "resolve-plugin-key.complete",
        ref: String(ref),
        pluginKey: byKey,
        result: "ok",
      });
      return byKey;
    }

    const normalizedRef = normalizePluginName(String(ref));
    const matches = Array.from(this.registry.keys()).filter((key) => key.endsWith(`:${normalizedRef}`));

    if (matches.length === 0) {
      this.logWarn("resolve plugin key failed: no matches", {
        action: "resolve-plugin-key.failed",
        ref: String(ref),
        result: "failed",
        reason: "plugin_not_found",
      });
      throw new PluginsManagerError(
        "PLUGIN_NOT_FOUND",
        `plugin not found: ${String(ref)}`
      );
    }

    if (matches.length > 1) {
      this.logWarn("resolve plugin key failed: ambiguous", {
        action: "resolve-plugin-key.failed",
        ref: String(ref),
        matches,
        result: "failed",
        reason: "plugin_ambiguous",
      });
      throw new PluginsManagerError(
        "PLUGIN_AMBIGUOUS",
        `plugin ref is ambiguous: ${String(ref)} (use skill:<name> or system:<name>)`
      );
    }

    this.logInfo("resolve plugin key complete", {
      action: "resolve-plugin-key.complete",
      ref: String(ref),
      pluginKey: matches[0],
      result: "ok",
    });
    return matches[0] as PluginKey;
  }

  async onlineAll(options: StartupOptions = {}): Promise<StartupReport> {
    this.logInfo("onlineAll begin", {
      action: "online-all.begin",
      requestedCount: this.registry.size,
    });
    const requested = Array.from(this.registry.keys());
    const report = await this.onlineMany(requested, options);
    this.lastStartupReport = report;
    this.logInfo("onlineAll complete", {
      action: "online-all.complete",
      result: report.failed.length === 0 && report.blocked.length === 0 ? "ok" : "failed",
      started: report.started,
      skipped: report.skipped,
      failed: report.failed,
      blocked: report.blocked,
      cycles: report.cycles,
    });
    return report;
  }

  async online(ref: PluginRef, command: OnlineCommandOptions = {}): Promise<LifecycleActionResult> {
    const requestId = this.createManagerRequestId("command-online", {
      requestId:
        typeof command.onlineOptions === "object"
        && command.onlineOptions !== null
        && !Array.isArray(command.onlineOptions)
          ? (command.onlineOptions as Record<string, unknown>).reqId as string | undefined
          : undefined,
    });
    this.logInfo("online command begin", {
      action: "online.begin",
      requestId,
      ref: String(ref),
      onlineOptions: summarizeUnknown(command.onlineOptions ?? null),
      observability: {
        kind: "node",
        requestId,
        eventType: "online.begin",
      },
    });
    if (command.onlineOptions) {
      this.logRaw("online command raw options", requestId, "online.options.raw", {
        onlineOptions: command.onlineOptions,
      });
    }
    try {
      const key = this.resolvePluginKey(ref);
      const perPluginOnlineOptions: Record<string, OnlineOptions> = {};
      if (command.onlineOptions) {
        perPluginOnlineOptions[key] = command.onlineOptions;
      }

      const report = await this.onlineMany([key], {
        perPluginOnlineOptions,
      });

      if (report.started.includes(key) || report.skipped.includes(key)) {
        const runtime = this.ensureRuntime(key);
        this.logInfo("online command complete", {
          action: "online.complete",
          requestId,
          pluginKey: key,
          result: "ok",
          state: runtime.state,
          started: report.started.includes(key),
          observability: {
            kind: "node",
            requestId,
            eventType: "online.complete",
            outcome: "success",
          },
        });
        return {
          key,
          ok: true,
          state: runtime.state,
        };
      }

      const failed = [...report.failed, ...report.blocked].find((entry) => entry.key === key);
      const runtime = this.ensureRuntime(key);
      this.logWarn("online command failed", {
        action: "online.complete",
        requestId,
        pluginKey: key,
        result: "failed",
        state: runtime.state,
        error: failed?.reason ?? "online failed",
        observability: {
          kind: "node",
          requestId,
          eventType: "online.complete",
          outcome: "error",
        },
      });
      return {
        key,
        ok: false,
        state: runtime.state,
        error: failed?.reason ?? "online failed",
      };
    } catch (error) {
      const runtimeKey = typeof ref === "string" ? ref : "unknown";
      this.logError("online command threw error", {
        action: "online.error",
        requestId,
        pluginKey: runtimeKey,
        result: "failed",
        error: toErrorMessageSafe(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "online.complete",
          outcome: "error",
        },
      });
      return {
        key: runtimeKey,
        ok: false,
        state: "error",
        error: toErrorMessage(error),
      };
    }
  }

  async offline(ref: PluginRef): Promise<LifecycleActionResult> {
    const requestId = this.createManagerRequestId("command-offline");
    this.logInfo("offline command begin", {
      action: "offline.begin",
      requestId,
      ref: String(ref),
      observability: {
        kind: "node",
        requestId,
        eventType: "offline.begin",
      },
    });
    let key: string = typeof ref === "string" ? ref : "unknown";
    try {
      key = this.resolvePluginKey(ref);
    } catch (error) {
      this.logWarn("offline command failed to resolve key", {
        action: "offline.error",
        requestId,
        pluginKey: String(key),
        result: "failed",
        error: toErrorMessageSafe(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "offline.complete",
          outcome: "error",
        },
      });
      return {
        key: String(key),
        ok: false,
        state: "error",
        error: toErrorMessage(error),
      };
    }

    try {
      const resolvedKey = key as PluginKey;
      const handle = this.ensureHandle(resolvedKey);
      const runtime = this.ensureRuntime(resolvedKey);
      const result = await runOfflineLifecycle({
        handle,
        runtime,
        logger: this.logger,
        requestId,
      });
      if (result.ok) {
        this.capabilityRegistry.removeByPluginInternal(resolvedKey);
      }
      this.logInfo("offline command complete", {
        action: "offline.complete",
        requestId,
        pluginKey: resolvedKey,
        result: result.ok ? "ok" : "failed",
        state: result.state,
        error: result.error ?? null,
        observability: {
          kind: "node",
          requestId,
          eventType: "offline.complete",
          outcome: result.ok ? "success" : "error",
        },
      });
      return result;
    } catch (error) {
      return this.handleLifecycleError(key as PluginKey, "OFFLINE_FAILED", error, requestId);
    }
  }

  async restart(ref: PluginRef, command: OnlineCommandOptions = {}): Promise<LifecycleActionResult> {
    const requestId = this.createManagerRequestId("command-restart", {
      requestId:
        typeof command.onlineOptions === "object"
        && command.onlineOptions !== null
        && !Array.isArray(command.onlineOptions)
          ? (command.onlineOptions as Record<string, unknown>).reqId as string | undefined
          : undefined,
    });
    this.logInfo("restart command begin", {
      action: "restart.begin",
      requestId,
      ref: String(ref),
      onlineOptions: summarizeUnknown(command.onlineOptions ?? null),
      observability: {
        kind: "node",
        requestId,
        eventType: "restart.begin",
      },
    });
    if (command.onlineOptions) {
      this.logRaw("restart command raw options", requestId, "restart.options.raw", {
        onlineOptions: command.onlineOptions,
      });
    }
    let key: string = typeof ref === "string" ? ref : "unknown";
    try {
      key = this.resolvePluginKey(ref);
    } catch (error) {
      this.logWarn("restart command failed to resolve key", {
        action: "restart.error",
        requestId,
        pluginKey: String(key),
        result: "failed",
        error: toErrorMessageSafe(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "restart.complete",
          outcome: "error",
        },
      });
      return {
        key: String(key),
        ok: false,
        state: "error",
        error: toErrorMessage(error),
      };
    }

    try {
      const resolvedKey = key as PluginKey;
      const handle = this.ensureHandle(resolvedKey);
      const runtime = this.ensureRuntime(resolvedKey);

      const result = await runRestartLifecycle({
        handle,
        runtime,
        command,
        logger: this.logger,
        requestId,
      });
      this.registerCapabilityProviders(resolvedKey, handle.module);
      this.logInfo("restart command complete", {
        action: "restart.complete",
        requestId,
        pluginKey: resolvedKey,
        result: result.ok ? "ok" : "failed",
        state: result.state,
        error: result.error ?? null,
        observability: {
          kind: "node",
          requestId,
          eventType: "restart.complete",
          outcome: result.ok ? "success" : "error",
        },
      });
      return result;
    } catch (error) {
      return this.handleLifecycleError(key as PluginKey, "RESTART_FAILED", error, requestId);
    }
  }

  async send(ref: PluginRef, payload: SendOptions): Promise<LifecycleActionResult<unknown>> {
    const requestId = this.createManagerRequestId("command-send", {
      requestId:
        typeof payload === "object"
        && payload !== null
        && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).reqId as string | undefined
          : undefined,
    });
    this.logInfo("send command begin", {
      action: "send.begin",
      requestId,
      ref: String(ref),
      payload: summarizeUnknown(payload),
      observability: {
        kind: "node",
        requestId,
        eventType: "send.begin",
      },
    });
    this.logRaw("send command raw payload", requestId, "send.payload.raw", {
      payload,
    });
    let key: string = typeof ref === "string" ? ref : "unknown";
    try {
      key = this.resolvePluginKey(ref);
    } catch (error) {
      this.logWarn("send command failed to resolve key", {
        action: "send.error",
        requestId,
        pluginKey: String(key),
        result: "failed",
        error: toErrorMessageSafe(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "send.complete",
          outcome: "error",
        },
      });
      return {
        key: String(key),
        ok: false,
        state: "error",
        error: toErrorMessage(error),
      };
    }

    try {
      const resolvedKey = key as PluginKey;
      const handle = this.ensureHandle(resolvedKey);
      const runtime = this.ensureRuntime(resolvedKey);
      const command: SendCommandOptions = { payload };
      const result = await runSendLifecycle({
        handle,
        runtime,
        command,
        logger: this.logger,
        requestId,
      });
      this.logInfo("send command complete", {
        action: "send.complete",
        requestId,
        pluginKey: resolvedKey,
        result: result.ok ? "ok" : "failed",
        state: result.state,
        value: summarizeUnknown(result.value),
        error: result.error ?? null,
        observability: {
          kind: "node",
          requestId,
          eventType: "send.complete",
          outcome: result.ok ? "success" : "error",
        },
      });
      this.logRaw("send command raw value", requestId, "send.value.raw", {
        value: result.value,
      });
      return result;
    } catch (error) {
      return this.handleLifecycleError(key as PluginKey, "SEND_FAILED", error, requestId);
    }
  }

  async state(ref: PluginRef): Promise<StateResult> {
    const requestId = this.createManagerRequestId("command-state");
    this.logInfo("state command begin", {
      action: "state.begin",
      requestId,
      ref: String(ref),
      observability: {
        kind: "node",
        requestId,
        eventType: "state.begin",
      },
    });
    let key: string = typeof ref === "string" ? ref : "unknown";
    try {
      key = this.resolvePluginKey(ref);
    } catch (error) {
      this.logWarn("state command failed to resolve key", {
        action: "state.error",
        requestId,
        pluginKey: String(key),
        result: "failed",
        error: toErrorMessageSafe(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "state.complete",
          outcome: "error",
        },
      });
      return {
        key: String(key),
        ok: false,
        managerState: "error",
        error: toErrorMessage(error),
      };
    }

    const resolvedKey = key as PluginKey;
    const runtime = this.ensureRuntime(resolvedKey);

    try {
      const handle = this.ensureHandle(resolvedKey);
      const pluginState = await runStateLifecycle({
        handle,
        runtime,
        logger: this.logger,
        requestId,
      });
      this.logInfo("state command complete", {
        action: "state.complete",
        requestId,
        pluginKey: resolvedKey,
        result: "ok",
        managerState: runtime.state,
        pluginState,
        observability: {
          kind: "node",
          requestId,
          eventType: "state.complete",
          outcome: "success",
        },
      });
      return {
        key: resolvedKey,
        ok: true,
        managerState: runtime.state,
        pluginState,
      };
    } catch (error) {
      const message = toErrorMessage(error);
      runtime.state = "error";
      runtime.lastError = message;
      this.logError("state command failed", {
        action: "state.error",
        requestId,
        pluginKey: resolvedKey,
        result: "failed",
        error: message,
        observability: {
          kind: "node",
          requestId,
          eventType: "state.complete",
          outcome: "error",
        },
      });
      return {
        key: resolvedKey,
        ok: false,
        managerState: runtime.state,
        error: message,
      };
    }
  }

  async offlineAll(): Promise<LifecycleActionResult[]> {
    this.logInfo("offlineAll begin", {
      action: "offline-all.begin",
    });
    const results: LifecycleActionResult[] = [];

    for (const [key, runtime] of this.runtime.entries()) {
      if (runtime.state !== "online" && runtime.state !== "error") {
        continue;
      }

      try {
        const handle = this.ensureHandle(key);
        const result = await runOfflineLifecycle({ handle, runtime, logger: this.logger });
        if (result.ok) {
          this.capabilityRegistry.removeByPluginInternal(key);
        }
        results.push(result);
      } catch (error) {
        results.push(this.handleLifecycleError(key, "OFFLINE_FAILED", error));
      }
    }

    this.logInfo("offlineAll complete", {
      action: "offline-all.complete",
      result: results.every((item) => item.ok) ? "ok" : "failed",
      results,
    });
    return results;
  }

  private ensureRuntime(key: PluginKey): PluginRuntime {
    const runtime = this.runtime.get(key);
    if (runtime) {
      return runtime;
    }

    const created = initializeRuntime();
    this.runtime.set(key, created);
    return created;
  }

  private ensureHandle(key: PluginKey): PluginHandle {
    const existed = this.handles.get(key);
    if (existed) {
      this.logInfo("ensure handle hit cache", {
        action: "ensure-handle.cache-hit",
        pluginKey: key,
      });
      return existed;
    }

    const descriptor = this.registry.get(key);
    if (!descriptor) {
      throw new PluginsManagerError(
        "PLUGIN_NOT_FOUND",
        `plugin not found: ${key}`
      );
    }

    const handle = loadPluginHandle(descriptor);
    this.handles.set(key, handle);
    const runtime = this.ensureRuntime(key);
    runtime.moduleLoaded = true;
    this.logInfo("ensure handle loaded module", {
      action: "ensure-handle.loaded",
      pluginKey: key,
      entryPath: descriptor.entryPath,
      result: "ok",
    });

    return handle;
  }

  private registerCapabilityProviders(key: PluginKey, plugin: IPlugin): void {
    this.logInfo("register capability providers begin", {
      action: "capability-register.begin",
      pluginKey: key,
    });
    const capabilities = this.capabilitiesManager.listCapabilitiesByPlugin(key);
    if (capabilities.length === 0) {
      this.logInfo("register capability providers skipped", {
        action: "capability-register.skip",
        pluginKey: key,
        result: "no-capabilities",
      });
      return;
    }

    if (typeof plugin.getCapabilityBindings !== "function") {
      throw new PluginsManagerError(
        "CAPABILITY_BINDING_INVALID",
        `${key} provides capabilities but plugin.getCapabilityBindings() is missing`
      );
    }

    const rawBindings = plugin.getCapabilityBindings();
    if (!Array.isArray(rawBindings) || rawBindings.length === 0) {
      throw new PluginsManagerError(
        "CAPABILITY_BINDING_INVALID",
        `${key} getCapabilityBindings() must return a non-empty array`
      );
    }

    const bindingByCapabilityId = new Map<string, CapabilityBinding>();
    for (let index = 0; index < rawBindings.length; index += 1) {
      const rawBinding = rawBindings[index] as CapabilityBinding;
      if (!rawBinding || typeof rawBinding !== "object") {
        throw new PluginsManagerError(
          "CAPABILITY_BINDING_INVALID",
          `${key} capability binding[${index}] must be an object`
        );
      }

      const capabilityId = ensureNonEmptyString(
        (rawBinding as { capabilityId?: unknown }).capabilityId,
        "CAPABILITY_BINDING_INVALID",
        `${key} capability binding[${index}] capabilityId must be a non-empty string`
      );

      if (typeof rawBinding.createProvider !== "function") {
        throw new PluginsManagerError(
          "CAPABILITY_BINDING_INVALID",
          `${key} capability binding[${index}] createProvider must be a function`
        );
      }

      if (bindingByCapabilityId.has(capabilityId)) {
        throw new PluginsManagerError(
          "CAPABILITY_BINDING_INVALID",
          `${key} contains duplicated capability binding: ${capabilityId}`
        );
      }

      bindingByCapabilityId.set(capabilityId, {
        capabilityId,
        createProvider: rawBinding.createProvider,
      });
    }

    const declaredCapabilityIds = capabilities.map((capability) => capability.id);
    const declaredCapabilitySet = new Set(declaredCapabilityIds);

    for (const capabilityId of bindingByCapabilityId.keys()) {
      if (!declaredCapabilitySet.has(capabilityId)) {
        throw new PluginsManagerError(
          "CAPABILITY_BINDING_INVALID",
          `${key} exposes binding for undeclared capability: ${capabilityId}`
        );
      }
    }

    for (const capabilityId of declaredCapabilityIds) {
      if (!bindingByCapabilityId.has(capabilityId)) {
        throw new PluginsManagerError(
          "CAPABILITY_BINDING_INVALID",
          `${key} missing capability binding: ${capabilityId}`
        );
      }
    }

    this.capabilityRegistry.removeByPluginInternal(key);

    try {
      const registeredAt = new Date().toISOString();

      for (const capabilityId of declaredCapabilityIds) {
        const binding = bindingByCapabilityId.get(capabilityId) as CapabilityBinding;
        let capabilityProvider: CapabilityProviderInstance;

        try {
          capabilityProvider = binding.createProvider(plugin) as CapabilityProviderInstance;
        } catch (error) {
          throw new PluginsManagerError(
            "CAPABILITY_BINDING_INVALID",
            `${key} failed to create provider for ${capabilityId}: ${toErrorMessage(error)}`,
            error
          );
        }

        this.capabilityRegistry.register(capabilityId, capabilityProvider, {
          pluginKey: key,
          registeredAt,
        });
        this.logInfo("register capability provider success", {
          action: "capability-register.item",
          pluginKey: key,
          capabilityId,
          registeredAt,
          result: "ok",
        });
      }
      this.logInfo("register capability providers complete", {
        action: "capability-register.complete",
        pluginKey: key,
        capabilityIds: declaredCapabilityIds,
        result: "ok",
      });
    } catch (error) {
      this.capabilityRegistry.removeByPluginInternal(key);
      this.logError("register capability providers failed", {
        action: "capability-register.error",
        pluginKey: key,
        result: "failed",
        error: toErrorMessageSafe(error),
      });
      throw error;
    }
  }

  private restoreOnlineCapabilityProviders(): void {
    this.logInfo("restore online capability providers begin", {
      action: "capability-restore.begin",
    });
    for (const [key, runtime] of this.runtime.entries()) {
      if (runtime.state !== "online") {
        continue;
      }

      const handle = this.handles.get(key);
      if (!handle) {
        continue;
      }

      try {
        this.registerCapabilityProviders(key, handle.module);
      } catch (error) {
        const message = toErrorMessage(error);
        runtime.state = "error";
        runtime.lastError = message;
        this.logError("restore capability providers failed", {
          action: "capability-restore.error",
          pluginKey: key,
          result: "failed",
          error: message,
        });
      }
    }
    this.logInfo("restore online capability providers complete", {
      action: "capability-restore.complete",
      result: "ok",
    });
  }

  private resolveOnlineOptions(
    key: PluginKey,
    startupOptions: StartupOptions
  ): OnlineOptions | undefined {
    const perPlugin = startupOptions.perPluginOnlineOptions ?? {};

    const direct = perPlugin[key];
    if (direct) {
      this.logInfo("resolved online options by plugin key", {
        action: "online-options.resolve",
        pluginKey: key,
        source: "perPlugin.key",
        onlineOptions: summarizeUnknown(direct),
      });
      return direct;
    }

    const normalizedName = key.split(":")[1];
    const byName = perPlugin[normalizedName];
    if (byName) {
      this.logInfo("resolved online options by plugin name", {
        action: "online-options.resolve",
        pluginKey: key,
        source: "perPlugin.name",
        onlineOptions: summarizeUnknown(byName),
      });
      return byName;
    }

    if (startupOptions.defaultOnlineOptions) {
      const resolved = startupOptions.defaultOnlineOptions as OnlineOptions;
      this.logInfo("resolved online options by default options", {
        action: "online-options.resolve",
        pluginKey: key,
        source: "default",
        onlineOptions: summarizeUnknown(resolved),
      });
      return resolved;
    }

    this.logInfo("resolved online options with empty value", {
      action: "online-options.resolve",
      pluginKey: key,
      source: "none",
      onlineOptions: null,
    });
    return undefined;
  }

  private async startPlugin(
    key: PluginKey,
    startupOptions: StartupOptions
  ): Promise<LifecycleActionResult> {
    const beginAt = Date.now();
    const requestId = this.createManagerRequestId("start-plugin", {
      pluginKey: key,
    });
    this.logInfo("start plugin begin", {
      action: "start-plugin.begin",
      pluginKey: key,
      requestId,
      observability: {
        kind: "node",
        requestId,
        eventType: "start-plugin.begin",
      },
    });
    try {
      const handle = this.ensureHandle(key);
      const runtime = this.ensureRuntime(key);
      const onlineOptions = this.resolveOnlineOptions(key, startupOptions);
      if (onlineOptions) {
        this.logRaw("start plugin raw online options", requestId, "start-plugin.options.raw", {
          onlineOptions,
        });
      }

      const result = await runOnlineLifecycle({
        handle,
        runtime,
        command: { onlineOptions },
        logger: this.logger,
        requestId,
      });
      this.registerCapabilityProviders(key, handle.module);
      this.logInfo("start plugin complete", {
        action: "start-plugin.complete",
        pluginKey: key,
        requestId,
        result: result.ok ? "ok" : "failed",
        state: result.state,
        durationMs: Date.now() - beginAt,
        observability: {
          kind: "node",
          requestId,
          eventType: "start-plugin.complete",
          outcome: result.ok ? "success" : "error",
        },
      });

      return result;
    } catch (error) {
      this.logError("start plugin failed", {
        action: "start-plugin.error",
        pluginKey: key,
        requestId,
        result: "failed",
        durationMs: Date.now() - beginAt,
        error: toErrorMessageSafe(error),
        observability: {
          kind: "node",
          requestId,
          eventType: "start-plugin.complete",
          outcome: "error",
        },
      });
      return this.handleLifecycleError(key, "ONLINE_FAILED", error, requestId);
    }
  }

  private async onlineMany(requestedKeys: PluginKey[], startupOptions: StartupOptions): Promise<StartupReport> {
    this.logInfo("onlineMany begin", {
      action: "online-many.begin",
      requestedKeys,
    });
    const dedupRequested = [...new Set(requestedKeys)];
    const requestedSet = new Set<PluginKey>(dedupRequested);
    const failedKeys = new Set<PluginKey>();

    const report: StartupReport = {
      requested: dedupRequested,
      started: [],
      skipped: [],
      failed: [],
      blocked: [],
      cycles: [],
    };

    const pending = new Set<PluginKey>();
    for (const key of dedupRequested) {
      const runtime = this.ensureRuntime(key);
      if (runtime.state === "online") {
        report.skipped.push(key);
        this.logInfo("onlineMany skipped already online plugin", {
          action: "online-many.skip",
          pluginKey: key,
          result: "already-online",
        });
      } else {
        pending.add(key);
      }
    }

    const dependencyGraph = analyzeDependencyGraph(pending, this.registry, this.logger);
    report.cycles = dependencyGraph.cycles;
    this.logInfo("onlineMany dependency graph ready", {
      action: "online-many.dependency-graph",
      cycleCount: report.cycles.length,
      cycles: report.cycles,
    });

    let wave = 0;
    while (pending.size > 0) {
      wave += 1;
      this.logInfo("onlineMany wave begin", {
        action: "online-many.wave.begin",
        wave,
        pending: Array.from(pending),
      });
      const ready: PluginKey[] = [];

      for (const key of Array.from(pending)) {
        const descriptor = this.registry.get(key);
        if (!descriptor) {
          pending.delete(key);
          failedKeys.add(key);
          report.failed.push(toFailure(key, "plugin descriptor missing"));
          this.logError("onlineMany failed due to missing descriptor", {
            action: "online-many.wave.failed",
            wave,
            pluginKey: key,
            result: "failed",
            reason: "plugin descriptor missing",
          });
          continue;
        }

        const status = evaluateDependencyStatus({
          descriptor,
          registry: this.registry,
          runtime: this.runtime,
          requestedKeys: requestedSet,
          failedKeys,
          componentByKey: dependencyGraph.componentByKey,
          logger: this.logger,
        });

        if (status.kind === "satisfied") {
          ready.push(key);
          continue;
        }

        if (status.kind === "failed") {
          pending.delete(key);
          failedKeys.add(key);
          const runtime = this.ensureRuntime(key);
          runtime.state = "blocked";
          runtime.lastError = status.reason;
          report.failed.push(toFailure(key, status.reason));
          this.logWarn("onlineMany failed during dependency evaluation", {
            action: "online-many.wave.failed",
            wave,
            pluginKey: key,
            result: "failed",
            reason: status.reason,
          });
        }
      }

      if (ready.length === 0) {
        this.logWarn("onlineMany deadlock detected", {
          action: "online-many.deadlock",
          wave,
          pending: Array.from(pending),
        });
        for (const key of Array.from(pending)) {
          pending.delete(key);
          failedKeys.add(key);
          const runtime = this.ensureRuntime(key);
          runtime.state = "blocked";
          runtime.lastError = "dependency deadlock";
          report.blocked.push(toFailure(key, "dependency deadlock"));
        }
        break;
      }

      ready.sort((a, b) => {
        const weightA = this.registry.get(a)?.startupWeight ?? 0;
        const weightB = this.registry.get(b)?.startupWeight ?? 0;
        if (weightA !== weightB) {
          return weightB - weightA;
        }
        return a.localeCompare(b);
      });

      const waveResults = await Promise.all(
        ready.map((key) => this.startPlugin(key, startupOptions))
      );
      this.logInfo("onlineMany wave complete", {
        action: "online-many.wave.complete",
        wave,
        ready,
        waveResults,
      });

      for (const result of waveResults) {
        const key = result.key as PluginKey;
        pending.delete(key);

        if (result.ok) {
          report.started.push(key);
          continue;
        }

        failedKeys.add(key);
        report.failed.push(toFailure(key, result.error ?? "online failed"));
      }
    }

    this.logInfo("onlineMany complete", {
      action: "online-many.complete",
      result: report.failed.length === 0 && report.blocked.length === 0 ? "ok" : "failed",
      report,
    });
    return report;
  }

  private handleLifecycleError(
    key: PluginKey,
    code: keyof typeof PluginsManagerErrorCode,
    error: unknown,
    requestId?: string
  ): LifecycleActionResult {
    const message = toErrorMessage(error);
    const runtime = this.ensureRuntime(key);

    runtime.state = "error";
    runtime.lastError = message;

    this.logError("lifecycle action failed", {
      action: "lifecycle.error",
      pluginKey: key,
      requestId: requestId ?? null,
      code,
      result: "failed",
      error: message,
      observability: requestId
        ? {
            kind: "node",
            requestId,
            eventType: "lifecycle.error",
            outcome: "error",
          }
        : { kind: "node" },
    });

    return {
      key,
      ok: false,
      state: runtime.state,
      error: message,
    };
  }
}

const pluginsManager = new PluginsManager({
  capabilityRegistry: defaultCapabilityRegistry,
});

export default pluginsManager;

