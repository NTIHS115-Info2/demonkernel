import type {
  OnlineMethod,
  OnlineOptions,
  OnlineOptionsOneOfEntry,
  OptionSchemaField,
  PluginManifest,
} from "./types";
import { PluginSdkError } from "./errors";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fieldTypeOk(value: unknown, field: OptionSchemaField): boolean {
  if (value === undefined || value === null) {
    return !!field.optional;
  }

  switch (field.type) {
    case "string": {
      if (typeof value !== "string") return false;
      if (field.enum) return field.enum.includes(value);
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
  const hit = oneOf.find((entry) => entry.when?.method === method);
  return hit?.schema ?? null;
}

export function validateManifest(manifest: PluginManifest): void {
  if (!manifest?.meta?.name || !manifest.meta.version || !manifest.meta.type || !manifest.meta.entry) {
    throw new PluginSdkError("MANIFEST_INVALID", "manifest.meta missing required fields");
  }

  if (!manifest.runtime || typeof manifest.runtime.startupWeight !== "number") {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      "manifest.runtime.startupWeight must be a number"
    );
  }

  if ("priority" in (manifest.runtime as Record<string, unknown>)) {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      "manifest.runtime.priority is not supported; use runtime.startupWeight"
    );
  }

  const methods = manifest.runtime.method;
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      "manifest.runtime.method must be a non-empty array"
    );
  }

  for (const method of methods) {
    if (method !== "local" && method !== "remote") {
      throw new PluginSdkError(
        "MANIFEST_INVALID",
        `invalid runtime method: ${String(method)}`
      );
    }
  }

  const dependencies = manifest.dependencies ?? {};
  for (const type of ["skill", "system"] as const) {
    const map = dependencies[type] ?? {};
    for (const [name, version] of Object.entries(map)) {
      if (typeof version !== "string" || version.trim().length === 0) {
        throw new PluginSdkError(
          "MANIFEST_INVALID",
          `manifest.dependencies.${type}.${name} must be a non-empty string`
        );
      }
    }
  }

  const onlineOptions = manifest.runtime.onlineOptions;
  if (!onlineOptions) {
    return;
  }

  if (!Array.isArray(onlineOptions.oneOf) || onlineOptions.oneOf.length === 0) {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      "runtime.onlineOptions.oneOf must be a non-empty array"
    );
  }

  for (const entry of onlineOptions.oneOf as OnlineOptionsOneOfEntry[]) {
    const method = entry?.when?.method;
    if (!method || (method !== "local" && method !== "remote")) {
      throw new PluginSdkError(
        "MANIFEST_INVALID",
        "onlineOptions.oneOf.when.method is invalid"
      );
    }

    if (!methods.includes(method)) {
      throw new PluginSdkError(
        "MANIFEST_INVALID",
        `onlineOptions method ${method} is not listed in runtime.method`
      );
    }

    if (!entry.schema || !isRecord(entry.schema)) {
      throw new PluginSdkError(
        "MANIFEST_INVALID",
        `onlineOptions schema missing for method ${method}`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(entry.schema, "method")) {
      throw new PluginSdkError(
        "MANIFEST_INVALID",
        `schema for method ${method} must include field "method"`
      );
    }
  }
}

export function validateOnlineOptions(manifest: PluginManifest, options: OnlineOptions): void {
  if (!options || !options.method) {
    throw new PluginSdkError("OPTIONS_INVALID", "online options missing method");
  }

  if (!manifest.runtime.method.includes(options.method)) {
    throw new PluginSdkError(
      "METHOD_NOT_ALLOWED",
      `method ${options.method} is not allowed by manifest.runtime.method`
    );
  }

  const schema = getSchemaForMethod(manifest, options.method);
  if (!schema) {
    throw new PluginSdkError(
      "OPTIONS_INVALID",
      `no schema defined for method ${options.method}`
    );
  }

  const errors: string[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = options[fieldName];
    if (!fieldTypeOk(value, fieldSchema)) {
      const required = fieldSchema.optional ? "optional" : "required";
      errors.push(`field ${fieldName} invalid/missing (${required})`);
    }
  }

  if (errors.length > 0) {
    throw new PluginSdkError("OPTIONS_INVALID", errors.join("; "));
  }
}
