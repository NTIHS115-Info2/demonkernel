import type { CapabilitiesManager } from "../capabilities";

import {
  CapabilityAlreadyRegisteredError,
  CapabilityNotFoundError,
  InvalidCapabilityProviderError,
} from "./errors";
import type { CapabilityProvider, RegistryListItem, RegistryMetadata } from "./types";

type CapabilityRegistryEntry = {
  provider: CapabilityProvider;
  metadata: RegistryMetadata;
};

export interface CapabilityRegistryOptions {
  capabilitiesManager: CapabilitiesManager;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneMetadata(metadata: RegistryMetadata): RegistryMetadata {
  return {
    pluginKey: metadata.pluginKey,
    registeredAt: metadata.registeredAt,
  };
}

export class CapabilityRegistry {
  private readonly capabilitiesManager: CapabilitiesManager;
  private readonly entriesByCapabilityId = new Map<string, CapabilityRegistryEntry>();

  constructor(options: CapabilityRegistryOptions) {
    this.capabilitiesManager = options.capabilitiesManager;
  }

  register(capabilityId: string, provider: CapabilityProvider, metadata: RegistryMetadata): void {
    this.ensureCapabilityExists(capabilityId);
    this.ensureProvider(capabilityId, provider);
    this.ensureMetadata(capabilityId, metadata);

    if (this.entriesByCapabilityId.has(capabilityId)) {
      throw new CapabilityAlreadyRegisteredError(capabilityId);
    }

    this.entriesByCapabilityId.set(capabilityId, {
      provider,
      metadata: cloneMetadata(metadata),
    });
  }

  resolve(capabilityId: string): CapabilityProvider {
    this.ensureCapabilityExists(capabilityId);
    const resolved = this.tryResolve(capabilityId);
    if (!resolved) {
      throw new CapabilityNotFoundError(
        capabilityId,
        `capability provider not registered: ${capabilityId}`
      );
    }

    return resolved;
  }

  tryResolve(capabilityId: string): CapabilityProvider | null {
    if (!isNonEmptyString(capabilityId)) {
      return null;
    }

    return this.entriesByCapabilityId.get(capabilityId)?.provider ?? null;
  }

  has(capabilityId: string): boolean {
    return this.tryResolve(capabilityId) !== null;
  }

  list(): RegistryListItem[] {
    return Array.from(this.entriesByCapabilityId.entries())
      .map(([capabilityId, entry]) => ({
        capabilityId,
        metadata: cloneMetadata(entry.metadata),
      }))
      .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  }

  // INTERNAL: only PluginsManager should use this cleanup API.
  removeByPluginInternal(pluginKey: string): void {
    if (!isNonEmptyString(pluginKey)) {
      return;
    }

    for (const [capabilityId, entry] of this.entriesByCapabilityId.entries()) {
      if (entry.metadata.pluginKey === pluginKey) {
        this.entriesByCapabilityId.delete(capabilityId);
      }
    }
  }

  // INTERNAL: only PluginsManager should use this cleanup API.
  clearInternal(): void {
    this.entriesByCapabilityId.clear();
  }

  isBoundTo(capabilitiesManager: CapabilitiesManager): boolean {
    return this.capabilitiesManager === capabilitiesManager;
  }

  // INTERNAL: used by PluginsManager constructor to keep manager/registry aligned.
  getCapabilitiesManagerInternal(): CapabilitiesManager {
    return this.capabilitiesManager;
  }

  private ensureCapabilityExists(capabilityId: string): void {
    if (!isNonEmptyString(capabilityId)) {
      throw new CapabilityNotFoundError(capabilityId, "capability id must be a non-empty string");
    }

    if (!this.capabilitiesManager.getCapabilityById(capabilityId)) {
      throw new CapabilityNotFoundError(
        capabilityId,
        `unknown capability id: ${capabilityId}`
      );
    }
  }

  private ensureProvider(capabilityId: string, provider: CapabilityProvider): void {
    if (!provider || typeof provider !== "object" || typeof provider.send !== "function") {
      throw new InvalidCapabilityProviderError(
        capabilityId,
        `provider for ${capabilityId} must expose send(input)`
      );
    }
  }

  private ensureMetadata(capabilityId: string, metadata: RegistryMetadata): void {
    if (!metadata || typeof metadata !== "object") {
      throw new InvalidCapabilityProviderError(
        capabilityId,
        `metadata for ${capabilityId} is required`
      );
    }

    if (!isNonEmptyString(metadata.pluginKey)) {
      throw new InvalidCapabilityProviderError(
        capabilityId,
        `metadata.pluginKey for ${capabilityId} must be a non-empty string`
      );
    }

    if (!isNonEmptyString(metadata.registeredAt) || Number.isNaN(Date.parse(metadata.registeredAt))) {
      throw new InvalidCapabilityProviderError(
        capabilityId,
        `metadata.registeredAt for ${capabilityId} must be a valid ISO datetime string`
      );
    }
  }
}
