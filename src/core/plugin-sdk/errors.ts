// src/core/plugin-sdk/errors.ts
import type { PluginError } from "./types";

export const CoreErrorCode = {
  MANIFEST_INVALID: "MANIFEST_INVALID",     // 插件清單格式錯誤
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED", // 不支援的 method
  OPTIONS_INVALID: "OPTIONS_INVALID",       // onlineOptions 格式錯誤
  STRATEGY_NOT_FOUND: "STRATEGY_NOT_FOUND", // 找不到對應的 strategy
  LIFECYCLE_INVALID: "LIFECYCLE_INVALID",   // 插件生命週期錯誤
  ONLINE_FAILED: "ONLINE_FAILED",           // 上線失敗
  OFFLINE_FAILED: "OFFLINE_FAILED",         // 下線失敗
  RESTART_FAILED: "RESTART_FAILED",         // 重啟失敗
  RUNNING_FAILED: "RUNNING_FAILED",         // 執行失敗
} as const;

export type CoreErrorCodeKey = keyof typeof CoreErrorCode;

export function makeError(
  code: CoreErrorCodeKey,
  message: string,
  cause?: unknown
): PluginError {
  return { code, message, cause };
}
