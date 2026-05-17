import type { CapabilityProviderInstance } from "../plugin-sdk";

export type CapabilityProvider = CapabilityProviderInstance;

export interface RegistryMetadata {
  pluginKey: string;
  registeredAt: string;
}

export interface RegistryListItem {
  capabilityId: string;
  metadata: RegistryMetadata;
}
