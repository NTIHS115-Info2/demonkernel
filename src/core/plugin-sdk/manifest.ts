// src/core/plugin-sdk/manifest.ts
import type {
  PluginManifest,
  OnlineMethod,
  OnlineOptions,
  OptionSchemaField,
  OnlineOptionsOneOfEntry,
  OnlineResult,
} from "./types";
import { CoreErrorCode, makeError } from "./errors";

// ---- 小工具 ----
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fieldTypeOk(value: unknown, field: OptionSchemaField): boolean {
  if (value === undefined || value === null) {
    return !!(field as any).optional;
  }

  switch (field.type) {
    case "string": {
      if (typeof value !== "string") return false;
      const en = (field as any).enum as string[] | undefined;
      if (en) return en.includes(value);
      return true;
    }
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null;
    default:
      return false;
  }
}

export function getSchemaForMethod(
  manifest: PluginManifest,
  method: OnlineMethod
): Record<string, OptionSchemaField> | null {
  const oneOf = manifest.runtime.onlineOptions?.oneOf ?? [];
  const hit = oneOf.find((e) => e.when?.method === method);
  return hit?.schema ?? null;
}

// ---- 1) Manifest 自洽驗證 ----
export function validateManifest(manifest: PluginManifest): OnlineResult<void> {
  // meta 基本欄位
  if (!manifest?.meta?.name || !manifest.meta.version || !manifest.meta.type || !manifest.meta.entry) {
    return {
      ok: false,
      error: makeError(CoreErrorCode.MANIFEST_INVALID, "manifest.meta missing required fields"),
    };
  }

  // runtime 基本欄位
  if (!manifest.runtime || typeof manifest.runtime.priority !== "number") {
    return {
      ok: false,
      error: makeError(CoreErrorCode.MANIFEST_INVALID, "manifest.runtime.priority must be a number"),
    };
  }

  // method 清單
  const methods = manifest.runtime.method;
  if (!Array.isArray(methods) || methods.length === 0) {
    return {
      ok: false,
      error: makeError(CoreErrorCode.MANIFEST_INVALID, "manifest.runtime.method must be a non-empty array"),
    };
  }
  // 防呆：method 值合法
  for (const m of methods) {
    if (m !== "local" && m !== "remote") {
      return {
        ok: false,
        error: makeError(CoreErrorCode.MANIFEST_INVALID, `invalid method "${String(m)}"`),
      };
    }
  }

  // onlineOptions oneOf 自洽
  const onlineOptions = manifest.runtime.onlineOptions;
  if (onlineOptions) {
    if (!Array.isArray(onlineOptions.oneOf) || onlineOptions.oneOf.length === 0) {
      return {
        ok: false,
        error: makeError(CoreErrorCode.MANIFEST_INVALID, "runtime.onlineOptions.oneOf must be a non-empty array"),
      };
    }

    for (const entry of onlineOptions.oneOf as OnlineOptionsOneOfEntry[]) {
      const whenMethod = entry?.when?.method;
      if (!whenMethod || (whenMethod !== "local" && whenMethod !== "remote")) {
        return {
          ok: false,
          error: makeError(CoreErrorCode.MANIFEST_INVALID, "onlineOptions.oneOf.when.method invalid"),
        };
      }
      if (!methods.includes(whenMethod)) {
        return {
          ok: false,
          error: makeError(
            CoreErrorCode.MANIFEST_INVALID,
            `onlineOptions has method="${whenMethod}" but runtime.method does not include it`
          ),
        };
      }
      if (!entry.schema || !isRecord(entry.schema)) {
        return {
          ok: false,
          error: makeError(CoreErrorCode.MANIFEST_INVALID, `onlineOptions.oneOf schema missing for "${whenMethod}"`),
        };
      }
      // schema 裡最好包含 method 欄位（你目前就是這樣設計）
      if (!("method" in entry.schema)) {
        return {
          ok: false,
          error: makeError(CoreErrorCode.MANIFEST_INVALID, `schema for "${whenMethod}" should include "method" field`),
        };
      }
    }
  }

  return { ok: true, value: undefined };
}

// ---- 2) options 驗證：依 manifest.onlineOptions.oneOf ----
export function validateOnlineOptions(
  manifest: PluginManifest,
  options: OnlineOptions
): OnlineResult<void> {
  // method 必填
  if (!options || !options.method) {
    return {
      ok: false,
      error: makeError(CoreErrorCode.OPTIONS_INVALID, "online options missing method"),
    };
  }

  // method 是否允許
  if (!manifest.runtime.method.includes(options.method)) {
    return {
      ok: false,
      error: makeError(
        CoreErrorCode.METHOD_NOT_ALLOWED,
        `method "${options.method}" not allowed by manifest.runtime.method`
      ),
    };
  }

  const schema = getSchemaForMethod(manifest, options.method);
  if (!schema) {
    return {
      ok: false,
      error: makeError(
        CoreErrorCode.OPTIONS_INVALID,
        `no onlineOptions schema for method "${options.method}"`
      ),
    };
  }

  // 逐欄位驗證（只驗 schema 定義的欄位）
  const errors: string[] = [];
  for (const [k, field] of Object.entries(schema)) {
    const v = (options as any)[k];
    if (!fieldTypeOk(v, field)) {
      const req = (field as any).optional ? "optional" : "required";
      errors.push(`field "${k}" invalid/missing (${req})`);
    }
  }

  if (errors.length) {
    return {
      ok: false,
      error: makeError(CoreErrorCode.OPTIONS_INVALID, errors.join("; ")),
    };
  }

  return { ok: true, value: undefined };
}
