import type { SendOptions } from "../plugin-sdk";

export interface CapabilityProvider {
  send(input: SendOptions): Promise<unknown>;
}

export interface RegistryMetadata {
  pluginKey: string;
  registeredAt: string;
}

export interface RegistryListItem {
  capabilityId: string;
  metadata: RegistryMetadata;
}
