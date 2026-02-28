// 基本列舉
export type PluginType = "skill" | "system";
export type OnlineMethod = "local" | "remote";
export type PluginError = {
    code : string;
    message : string;
    cause?: unknown;
}

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

// Manifest 型別（對齊 plugin.manifest.json）
export interface PluginManifest {
  meta: {
    name: string;
    version: string;
    type: PluginType;
    description?: string;
    entry: string;
  };
  runtime: {
    priority: number;
    method: OnlineMethod[];              // 你 JSON 裡是 method: ["local","remote"]
    onlineOptions?: { oneOf: OnlineOptionsOneOfEntry[] };
    errorCode?: Record<string, string>;  // "1000": "未知错误"
  };
  dependencies?: {
    system?: Record<string, string>; // ["asr", "tts"]
    skill?: Record<string, string>; // ["chatbot", "weather"]
  };
}

// ----------------- online 相關型別 -----------------

// online options 型別（online 方法的輸入參數，包含 method 和其他相關配置）
export type OnlineOptions = {
  method: OnlineMethod , [key: string]: unknown // 其他可選配置
};

// online options - strategy 
export type StrategyOnlineOptions = {
    [key: string]: unknown // 其他可選配置
}

// online return 型別（online 方法的返回值，包含狀態碼和可選的錯誤信息）
export type OnlineResult<T> = 
    | { ok : true ; value : T} 
    | { ok : false ; error : PluginError };

// ----------------- offline 相關型別 ----------------

// offline return 型別（offline 方法的返回值，包含狀態碼和可選的錯誤信息）
export type OfflineResult<T> = 
    | { ok : true ; value : T} 
    | { ok : false ; error : PluginError };

// ----------------- restart 相關型別 -----------------

export type RestartOptions = {
    method: OnlineMethod , [key: string]: unknown // 其他可選配置
}

export type StrategyRestartOptions = {
    [key: string]: unknown // 其他可選配置
}

export type RestartResult<T> = 
    | { ok : true ; value : T} 
    | { ok : false ; error : PluginError };

// ----------------- send 相關型別 -------------------

export type SendOptions = {
    [key: string]: unknown // 可選配置
};

export type SendResult<T> = 
    | { ok : true ; value : T} 
    | { ok : false ; error : PluginError };

// ----------------- state 相關型別 -------------------

export type StateCode = 0 | 1 | -1 | -2 | -3; // 0: offline, 1: online, -1: starting, -2: stopping, -3: error

export type StateResult<T> = 
    | { ok : true ; value : T}

// ----------------- Plugin 相關型別 -----------------

// Strategy 介面（local/remote 都要長一樣）
export interface IStrategy {
  method: OnlineMethod;
  online(options: StrategyOnlineOptions): Promise<OnlineResult<void>>;
  offline(): Promise<OfflineResult<void>>;
  restart(options: StrategyRestartOptions): Promise<RestartResult<void>>;
  state(): Promise<StateResult<{ status: StateCode }>>;
  send(options: SendOptions): Promise<SendResult<void>>;
}

// Plugin 介面（root index.ts export default 的物件）
export interface IPlugin {
  manifest: PluginManifest;
  online(options: OnlineOptions): Promise<OnlineResult<void>>;
  offline(): Promise<OfflineResult<void>>;
  restart(options: RestartOptions): Promise<RestartResult<void>>;
  state(): Promise<StateResult<{ status: StateCode }>>;
  send(options: SendOptions): Promise<SendResult<void>>;
}
