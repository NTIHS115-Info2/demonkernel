// 基本列舉
export type PluginType = "skill" | "system";
export type OnlineMethod = "local" | "remote";
export type PluginError = {
  code: string;
  message: string;
  cause?: unknown;
};
export type CapabilitySchemaType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "null";

export interface CapabilitySchema {
  type: CapabilitySchemaType | CapabilitySchemaType[];
  description?: string;
  properties?: Record<string, CapabilitySchema>;
  required?: string[];
  items?: CapabilitySchema;
  enum?: unknown[];
  additionalProperties?: boolean | CapabilitySchema;
}

export interface CapabilityTestCase {
  id: string;
  description?: string;
  input: unknown;
  expectedOutput?: unknown;
  expectError?: boolean;
}

export interface CapabilityDefinition {
  id: string;
  displayName: string;
  description: string;
  version: string;
  input: CapabilitySchema;
  output: CapabilitySchema;
  testCases?: CapabilityTestCase[];
}

export type CapabilityProvideEntry = string | CapabilityDefinition;

// ----------------- Manifest 相關型別 -----------------

export type OptionSchemaField =
  | { type: "string"; enum?: string[]; optional?: boolean }
  | { type: "number"; optional?: boolean }
  | { type: "boolean"; optional?: boolean }
  | { type: "object"; optional?: boolean };

export type OnlineOptionsOneOfEntry = {
  when: { method: OnlineMethod };
  schema: Record<string, OptionSchemaField>;
};

export interface PluginManifest {
  meta: {
    name: string;
    version: string;
    type: PluginType;
    description?: string;
    entry: string;
  };
  runtime: {
    startupWeight: number;
    method: OnlineMethod[];
    onlineOptions?: { oneOf: OnlineOptionsOneOfEntry[] };
    errorCode?: Record<string, string>;
  };
  dependencies?: {
    system?: Record<string, string>;
    skill?: Record<string, string>;
  };
  io?: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    examples?: Array<Record<string, unknown>>;
  };
  capabilities?: {
    provides: CapabilityProvideEntry[];
  };
}

// ----------------- online 相關型別 -----------------

export type OnlineOptions = {
  method: OnlineMethod;
  [key: string]: unknown;
};

export type StrategyOnlineOptions = {
  [key: string]: unknown;
};

// ----------------- offline 相關型別 ----------------

// throw-only lifecycle: offline 失敗時丟出錯誤

// ----------------- restart 相關型別 -----------------

export type RestartOptions = {
  method: OnlineMethod;
  [key: string]: unknown;
};

export type StrategyRestartOptions = {
  [key: string]: unknown;
};

// ----------------- send 相關型別 -------------------

export type SendOptions = {
  [key: string]: unknown;
};

// ----------------- state 相關型別 -------------------

export type StateCode = 0 | 1 | -1 | -2 | -3;

export type StateResult = {
  status: StateCode;
};

// ----------------- Plugin 相關型別 -----------------

export interface IStrategy {
  method: OnlineMethod;
  online(options: StrategyOnlineOptions): Promise<void>;
  offline(): Promise<void>;
  restart(options: StrategyRestartOptions): Promise<void>;
  state(): Promise<StateResult>;
  send(options: SendOptions): Promise<unknown>;
}

export interface IPlugin {
  online(options: OnlineOptions): Promise<void>;
  offline(): Promise<void>;
  restart(options: RestartOptions): Promise<void>;
  state(): Promise<StateResult>;
  send(options: SendOptions): Promise<unknown>;
}
