import type {
  CapabilityDefinition,
  CapabilitySchema,
  CapabilitySchemaType,
  CapabilityTestCase,
} from "../plugin-sdk";

import { CapabilitiesError } from "./errors";
import type { CapabilityValidationResult } from "./types";

const supportedSchemaTypes = new Set<CapabilitySchemaType>([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path} must be a non-empty string`);
  }
}

function toSchemaTypeList(type: CapabilitySchema["type"], path: string): CapabilitySchemaType[] {
  const list = Array.isArray(type) ? type : [type];
  if (list.length === 0) {
    throw new CapabilitiesError("INVALID_SCHEMA", `${path}.type must be non-empty`);
  }

  for (const value of list) {
    if (!supportedSchemaTypes.has(value)) {
      throw new CapabilitiesError("INVALID_SCHEMA", `${path}.type contains unsupported type: ${value}`);
    }
  }

  return list;
}

function validateCapabilitySchema(schema: unknown, path: string): CapabilitySchema {
  if (!isRecord(schema)) {
    throw new CapabilitiesError("INVALID_SCHEMA", `${path} must be an object`);
  }

  const type = schema.type as CapabilitySchema["type"];
  if (type === undefined) {
    throw new CapabilitiesError("INVALID_SCHEMA", `${path}.type is required`);
  }

  toSchemaTypeList(type, path);

  if ("description" in schema && typeof schema.description !== "string") {
    throw new CapabilitiesError("INVALID_SCHEMA", `${path}.description must be a string`);
  }

  const propertiesValue = schema.properties;
  if (propertiesValue !== undefined) {
    if (!isRecord(propertiesValue)) {
      throw new CapabilitiesError("INVALID_SCHEMA", `${path}.properties must be an object`);
    }

    for (const [key, value] of Object.entries(propertiesValue)) {
      validateCapabilitySchema(value, `${path}.properties.${key}`);
    }
  }

  const requiredValue = schema.required;
  if (requiredValue !== undefined) {
    if (!Array.isArray(requiredValue) || requiredValue.some((item) => typeof item !== "string")) {
      throw new CapabilitiesError("INVALID_SCHEMA", `${path}.required must be a string array`);
    }

    if (propertiesValue && requiredValue.some((field) => !Object.prototype.hasOwnProperty.call(propertiesValue, field))) {
      throw new CapabilitiesError(
        "INVALID_SCHEMA",
        `${path}.required contains fields not declared in ${path}.properties`
      );
    }
  }

  if (schema.items !== undefined) {
    validateCapabilitySchema(schema.items, `${path}.items`);
  }

  if (schema.enum !== undefined && !Array.isArray(schema.enum)) {
    throw new CapabilitiesError("INVALID_SCHEMA", `${path}.enum must be an array`);
  }

  const additionalProperties = schema.additionalProperties;
  if (additionalProperties !== undefined && typeof additionalProperties !== "boolean") {
    validateCapabilitySchema(additionalProperties, `${path}.additionalProperties`);
  }

  return schema as unknown as CapabilitySchema;
}

function validateTestCase(testCase: unknown, path: string): CapabilityTestCase {
  if (!isRecord(testCase)) {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path} must be an object`);
  }

  assertNonEmptyString(testCase.id, `${path}.id`);

  if ("description" in testCase && typeof testCase.description !== "string") {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path}.description must be a string`);
  }

  if (!Object.prototype.hasOwnProperty.call(testCase, "input")) {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path}.input is required`);
  }

  if ("expectError" in testCase && typeof testCase.expectError !== "boolean") {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path}.expectError must be a boolean`);
  }

  return testCase as unknown as CapabilityTestCase;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      output[key] = canonicalize(value[key]);
    }
    return output;
  }

  return value;
}

function schemaTypeMatches(type: CapabilitySchemaType, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isRecord(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return false;
  }
}

function deepEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function validateObjectFields(
  schema: CapabilitySchema,
  value: Record<string, unknown>,
  path: string
): string[] {
  const errors: string[] = [];
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const requiredField of required) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredField)) {
      errors.push(`${path}.${requiredField} is required`);
    }
  }

  for (const [key, nestedSchema] of Object.entries(properties)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }

    errors.push(...validateSchemaAgainstValue(nestedSchema, value[key], `${path}.${key}`));
  }

  const additionalProperties = schema.additionalProperties;
  const allowAdditionalProperties = additionalProperties === undefined || additionalProperties === true;

  for (const key of Object.keys(value)) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      continue;
    }

    if (allowAdditionalProperties) {
      continue;
    }

    if (additionalProperties === false) {
      errors.push(`${path}.${key} is not allowed`);
      continue;
    }

    errors.push(...validateSchemaAgainstValue(additionalProperties, value[key], `${path}.${key}`));
  }

  return errors;
}

function validateSchemaAgainstValue(schema: CapabilitySchema, value: unknown, path: string): string[] {
  const errors: string[] = [];
  const schemaTypes = toSchemaTypeList(schema.type, path);
  const typeMatched = schemaTypes.some((schemaType) => schemaTypeMatches(schemaType, value));

  if (!typeMatched) {
    errors.push(`${path} does not match schema type ${schemaTypes.join("|")}`);
    return errors;
  }

  if (schema.enum && !schema.enum.some((enumValue) => deepEqual(enumValue, value))) {
    errors.push(`${path} is not in enum`);
  }

  if (schemaTypes.includes("object") && isRecord(value)) {
    errors.push(...validateObjectFields(schema, value, path));
  }

  if (schemaTypes.includes("array") && Array.isArray(value) && schema.items) {
    for (let index = 0; index < value.length; index += 1) {
      errors.push(...validateSchemaAgainstValue(schema.items, value[index], `${path}[${index}]`));
    }
  }

  return errors;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function capabilityDefinitionsEqual(
  left: CapabilityDefinition,
  right: CapabilityDefinition
): boolean {
  return stableStringify(left) === stableStringify(right);
}

export function validateCapabilityDefinition(
  definition: unknown,
  path = "capability"
): CapabilityDefinition {
  if (!isRecord(definition)) {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path} must be an object`);
  }

  assertNonEmptyString(definition.id, `${path}.id`);
  assertNonEmptyString(definition.displayName, `${path}.displayName`);
  assertNonEmptyString(definition.description, `${path}.description`);
  assertNonEmptyString(definition.version, `${path}.version`);

  const input = validateCapabilitySchema(definition.input, `${path}.input`);
  const output = validateCapabilitySchema(definition.output, `${path}.output`);

  const testCasesValue = definition.testCases;
  if (testCasesValue !== undefined && !Array.isArray(testCasesValue)) {
    throw new CapabilitiesError("INVALID_CAPABILITY", `${path}.testCases must be an array`);
  }

  if (Array.isArray(testCasesValue)) {
    const testCaseIds = new Set<string>();
    for (let index = 0; index < testCasesValue.length; index += 1) {
      const testCase = validateTestCase(testCasesValue[index], `${path}.testCases[${index}]`);
      if (testCaseIds.has(testCase.id)) {
        throw new CapabilitiesError(
          "INVALID_CAPABILITY",
          `${path}.testCases contains duplicate id: ${testCase.id}`
        );
      }
      testCaseIds.add(testCase.id);
    }
  }

  return clone({
    ...(definition as unknown as CapabilityDefinition),
    input,
    output,
  });
}

export function validateValueWithSchema(
  schema: CapabilitySchema,
  value: unknown,
  path = "value"
): CapabilityValidationResult {
  const errors = validateSchemaAgainstValue(schema, value, path);
  return {
    ok: errors.length === 0,
    errors,
  };
}
