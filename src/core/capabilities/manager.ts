import type { CapabilityDefinition, CapabilityProvideEntry } from "../plugin-sdk";

import { CapabilitiesError } from "./errors";
import type {
  CapabilityRegistrySnapshotItem,
  CapabilitySource,
  RegisterPluginCapabilitiesInput,
} from "./types";
import { defaultCapabilities } from "./defaults";
import {
  capabilityDefinitionsEqual,
  validateCapabilityDefinition,
} from "./validator";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class CapabilitiesManager {
  private readonly defaultsById = new Map<string, CapabilityDefinition>();
  private readonly definitionsById = new Map<string, {
    capability: CapabilityDefinition;
    source: CapabilitySource;
  }>();
  private readonly providersByCapabilityId = new Map<string, Set<string>>();
  private readonly capabilitiesByPlugin = new Map<string, Set<string>>();

  constructor(initialDefaults: CapabilityDefinition[] = defaultCapabilities) {
    for (const definition of initialDefaults) {
      const validated = validateCapabilityDefinition(definition, `defaults.${definition.id}`);
      if (this.defaultsById.has(validated.id)) {
        throw new CapabilitiesError(
          "DUPLICATE_CAPABILITY_ID",
          `duplicate default capability id: ${validated.id}`
        );
      }
      this.defaultsById.set(validated.id, validated);
    }

    this.reset();
  }

  reset(): void {
    this.definitionsById.clear();
    this.providersByCapabilityId.clear();
    this.capabilitiesByPlugin.clear();

    for (const definition of this.defaultsById.values()) {
      this.definitionsById.set(definition.id, {
        capability: clone(definition),
        source: "default",
      });
    }
  }

  registerFromManifest(input: RegisterPluginCapabilitiesInput): void {
    const provides = input.provides ?? [];
    if (provides.length === 0) {
      return;
    }

    if (input.pluginType !== "system") {
      throw new CapabilitiesError(
        "UNSUPPORTED_PLUGIN_TYPE",
        `capabilities can only be registered by system plugin: ${input.pluginKey}`
      );
    }

    const seenInDeclaration = new Set<string>();
    const resolvedDefinitions: CapabilityDefinition[] = [];

    for (let index = 0; index < provides.length; index += 1) {
      const provideEntry = provides[index];
      const definition = this.resolveCapabilityEntry(
        provideEntry,
        input.manifestPath,
        index
      );

      if (seenInDeclaration.has(definition.id)) {
        throw new CapabilitiesError(
          "DUPLICATE_CAPABILITY_ID",
          `duplicate capability id ${definition.id} in ${input.pluginKey}`
        );
      }

      seenInDeclaration.add(definition.id);
      resolvedDefinitions.push(definition);
    }

    for (const definition of resolvedDefinitions) {
      const existing = this.definitionsById.get(definition.id);
      if (existing && !capabilityDefinitionsEqual(existing.capability, definition)) {
        throw new CapabilitiesError(
          "CAPABILITY_CONFLICT",
          `capability id ${definition.id} conflicts with existing definition`
        );
      }
    }

    for (const definition of resolvedDefinitions) {
      this.registerCapabilityForPlugin(input.pluginKey, definition);
    }
  }

  getCapabilityById(id: string): CapabilityDefinition | null {
    const record = this.definitionsById.get(id);
    if (!record) {
      return null;
    }

    return clone(record.capability);
  }

  listCapabilities(): CapabilityDefinition[] {
    return Array.from(this.definitionsById.values())
      .map((record) => clone(record.capability))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  listProviders(capabilityId: string): string[] {
    const providers = this.providersByCapabilityId.get(capabilityId);
    if (!providers) {
      return [];
    }

    return Array.from(providers).sort((left, right) => left.localeCompare(right));
  }

  listCapabilitiesByPlugin(pluginKey: string): CapabilityDefinition[] {
    const capabilityIds = this.capabilitiesByPlugin.get(pluginKey);
    if (!capabilityIds) {
      return [];
    }

    return Array.from(capabilityIds)
      .map((id) => this.definitionsById.get(id)?.capability)
      .filter((capability): capability is CapabilityDefinition => Boolean(capability))
      .map((capability) => clone(capability))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  getSnapshot(): CapabilityRegistrySnapshotItem[] {
    return Array.from(this.definitionsById.entries())
      .map(([id, record]) => ({
        capability: clone(record.capability),
        providers: this.listProviders(id),
        source: record.source,
      }))
      .sort((left, right) => left.capability.id.localeCompare(right.capability.id));
  }

  private resolveCapabilityEntry(
    entry: CapabilityProvideEntry,
    manifestPath: string | undefined,
    index: number
  ): CapabilityDefinition {
    if (typeof entry === "string") {
      const id = entry.trim();
      if (id.length === 0) {
        throw new CapabilitiesError(
          "INVALID_DECLARATION",
          `capabilities.provides[${index}] must be a non-empty string`
        );
      }

      const defaultCapability = this.defaultsById.get(id);
      if (!defaultCapability) {
        const source = manifestPath ? ` (${manifestPath})` : "";
        throw new CapabilitiesError(
          "UNKNOWN_DEFAULT_CAPABILITY",
          `unknown default capability id ${id}${source}`
        );
      }

      return clone(defaultCapability);
    }

    return validateCapabilityDefinition(entry, `capabilities.provides[${index}]`);
  }

  private registerCapabilityForPlugin(pluginKey: string, definition: CapabilityDefinition): void {
    const existing = this.definitionsById.get(definition.id);
    if (!existing) {
      this.definitionsById.set(definition.id, {
        capability: clone(definition),
        source: "plugin",
      });
    } else if (!capabilityDefinitionsEqual(existing.capability, definition)) {
      throw new CapabilitiesError(
        "CAPABILITY_CONFLICT",
        `capability id ${definition.id} conflicts with existing definition`
      );
    }

    if (!this.providersByCapabilityId.has(definition.id)) {
      this.providersByCapabilityId.set(definition.id, new Set());
    }
    this.providersByCapabilityId.get(definition.id)?.add(pluginKey);

    if (!this.capabilitiesByPlugin.has(pluginKey)) {
      this.capabilitiesByPlugin.set(pluginKey, new Set());
    }
    this.capabilitiesByPlugin.get(pluginKey)?.add(definition.id);
  }
}
