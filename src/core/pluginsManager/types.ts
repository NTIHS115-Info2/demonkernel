/* 註解：PluginsManager 對外與內部共用型別定義。 */
import type {
  IPlugin,
  OnlineMethod,
  OnlineOptions,
  PluginManifest,
  PluginType,
  SendOptions,
  StateCode,
} from "../plugin-sdk";
import type { CapabilitiesManager } from "../capabilities";

export type PluginKey = `${PluginType}:${string}`;
export type PluginRef = PluginKey | string;

export type RuntimeState = "offline" | "starting" | "online" | "stopping" | "error" | "blocked";

export interface ManagerLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug?(...args: unknown[]): void;
}

export interface PluginsManagerOptions {
  skillPluginsPath?: string;
  systemPluginsPath?: string;
  logger?: ManagerLogger;
  capabilitiesManager?: CapabilitiesManager;
}

export interface NormalizedDependencies {
  skill: Record<string, string>;
  system: Record<string, string>;
}

export interface PluginDescriptor {
  key: PluginKey;
  type: PluginType;
  name: string;
  normalizedName: string;
  version: string;
  startupWeight: number;
  directoryPath: string;
  manifestPath: string;
  entryPath: string;
  manifest: PluginManifest;
  dependencies: NormalizedDependencies;
}

export interface PluginRuntime {
  state: RuntimeState;
  lastError: string | null;
  lastStateCode: StateCode | null;
  moduleLoaded: boolean;
  onlineMethod: OnlineMethod | null;
}

export interface PluginRuntimeSnapshot extends PluginRuntime {
  key: PluginKey;
}

export interface PluginHandle {
  descriptor: PluginDescriptor;
  module: IPlugin;
}

export interface InvalidPluginRecord {
  type: PluginType;
  directory: string;
  manifestPath: string;
  reason: string;
  recordedAt: string;
}

export interface ScanSummaryByType {
  total: number;
  registered: number;
  invalid: number;
}

export interface ScanSummary {
  total: number;
  registered: number;
  invalid: number;
  byType: Record<PluginType, ScanSummaryByType>;
}

export interface LifecycleActionResult<T = void> {
  key: string;
  ok: boolean;
  state: RuntimeState;
  value?: T;
  error?: string;
}

export interface StartupFailure {
  key: PluginKey;
  reason: string;
}

export interface StartupOptions {
  defaultOnlineOptions?: Partial<OnlineOptions>;
  perPluginOnlineOptions?: Record<string, OnlineOptions>;
}

export interface StartupReport {
  requested: PluginKey[];
  started: PluginKey[];
  skipped: PluginKey[];
  failed: StartupFailure[];
  blocked: StartupFailure[];
  cycles: PluginKey[][];
}

export interface RegistrySnapshotItem {
  key: PluginKey;
  type: PluginType;
  name: string;
  version: string;
  startupWeight: number;
  manifestPath: string;
  entryPath: string;
  dependencies: NormalizedDependencies;
}

export interface StateResult {
  key: string;
  ok: boolean;
  managerState: RuntimeState;
  pluginState?: StateCode;
  error?: string;
}

export type DependencyRef = {
  owner: PluginKey;
  dependencyKey: PluginKey;
  expectedVersion: string;
};

export type DependencyStatus =
  | { kind: "satisfied" }
  | { kind: "waiting"; dependencyKey: PluginKey }
  | { kind: "failed"; reason: string };

export type DependencyComponentMap = Map<PluginKey, PluginKey[]>;

export interface DependencyGraphAnalysis {
  cycles: PluginKey[][];
  componentByKey: DependencyComponentMap;
}

export interface OnlineCommandOptions {
  onlineOptions?: OnlineOptions;
}

export interface SendCommandOptions {
  payload: SendOptions;
}

