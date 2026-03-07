import type {
  OnlineMethod,
  OnlineOptions,
  OnlineOptionsOneOfEntry,
  OptionSchemaField,
  CapabilityDefinition,
  CapabilitySchema,
  CapabilityTestCase,
  PluginManifest,
} from "./types";
import { PluginSdkError } from "./errors";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const capabilitySchemaTypes = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null",
]);

function validateCapabilitySchemaShape(schema: unknown, path: string): void {
  if (!isRecord(schema)) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path} must be an object`);
  }

  const typeValue = schema.type;
  const typeList = Array.isArray(typeValue) ? typeValue : [typeValue];

  if (typeList.length === 0 || typeList.some((value) => typeof value !== "string")) {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      `${path}.type must be a string or non-empty string array`
    );
  }

  for (const type of typeList) {
    if (!capabilitySchemaTypes.has(type)) {
      throw new PluginSdkError(
        "MANIFEST_INVALID",
        `${path}.type contains unsupported type: ${String(type)}`
      );
    }
  }

  if ("description" in schema && typeof schema.description !== "string") {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.description must be a string`);
  }

  if ("properties" in schema) {
    if (!isRecord(schema.properties)) {
      throw new PluginSdkError("MANIFEST_INVALID", `${path}.properties must be an object`);
    }

    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      validateCapabilitySchemaShape(propertySchema, `${path}.properties.${propertyName}`);
    }
  }

  if ("required" in schema) {
    if (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== "string")) {
      throw new PluginSdkError("MANIFEST_INVALID", `${path}.required must be a string array`);
    }
  }

  if ("items" in schema) {
    validateCapabilitySchemaShape(schema.items, `${path}.items`);
  }

  if ("enum" in schema && !Array.isArray(schema.enum)) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.enum must be an array`);
  }

  if ("additionalProperties" in schema) {
    const additionalProperties = schema.additionalProperties;
    if (typeof additionalProperties !== "boolean") {
      validateCapabilitySchemaShape(additionalProperties, `${path}.additionalProperties`);
    }
  }
}

function validateCapabilityTestCaseShape(testCase: unknown, path: string): void {
  if (!isRecord(testCase)) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path} must be an object`);
  }

  if (typeof testCase.id !== "string" || testCase.id.trim().length === 0) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.id must be a non-empty string`);
  }

  if (!Object.prototype.hasOwnProperty.call(testCase, "input")) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.input is required`);
  }

  if ("description" in testCase && typeof testCase.description !== "string") {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.description must be a string`);
  }

  if ("expectError" in testCase && typeof testCase.expectError !== "boolean") {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.expectError must be a boolean`);
  }
}

function validateCapabilityDefinitionShape(definition: unknown, path: string): void {
  if (!isRecord(definition)) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path} must be an object`);
  }

  const capability = definition as unknown as CapabilityDefinition;

  if (typeof capability.id !== "string" || capability.id.trim().length === 0) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.id must be a non-empty string`);
  }

  if (typeof capability.displayName !== "string" || capability.displayName.trim().length === 0) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.displayName must be a non-empty string`);
  }

  if (typeof capability.description !== "string" || capability.description.trim().length === 0) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.description must be a non-empty string`);
  }

  if (typeof capability.version !== "string" || capability.version.trim().length === 0) {
    throw new PluginSdkError("MANIFEST_INVALID", `${path}.version must be a non-empty string`);
  }

  validateCapabilitySchemaShape(capability.input as CapabilitySchema, `${path}.input`);
  validateCapabilitySchemaShape(capability.output as CapabilitySchema, `${path}.output`);

  if ("testCases" in capability && capability.testCases !== undefined) {
    if (!Array.isArray(capability.testCases)) {
      throw new PluginSdkError("MANIFEST_INVALID", `${path}.testCases must be an array`);
    }

    for (let index = 0; index < capability.testCases.length; index += 1) {
      validateCapabilityTestCaseShape(
        capability.testCases[index] as CapabilityTestCase,
        `${path}.testCases[${index}]`
      );
    }
  }
}

function validateCapabilitiesShape(manifest: PluginManifest): void {
  const capabilities = manifest.capabilities;
  if (!capabilities) {
    return;
  }

  if (manifest.meta.type !== "system") {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      "manifest.capabilities is only supported for system plugins"
    );
  }

  if (!isRecord(capabilities) || !Array.isArray(capabilities.provides) || capabilities.provides.length === 0) {
    throw new PluginSdkError(
      "MANIFEST_INVALID",
      "manifest.capabilities.provides must be a non-empty array"
    );
  }

  for (let index = 0; index < capabilities.provides.length; index += 1) {
    const provideEntry = capabilities.provides[index];

    if (typeof provideEntry === "string") {
      if (provideEntry.trim().length === 0) {
        throw new PluginSdkError(
          "MANIFEST_INVALID",
          `manifest.capabilities.provides[${index}] must be a non-empty string`
        );
      }
      continue;
    }

    validateCapabilityDefinitionShape(provideEntry, `manifest.capabilities.provides[${index}]`);
  }
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

  validateCapabilitiesShape(manifest);

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
