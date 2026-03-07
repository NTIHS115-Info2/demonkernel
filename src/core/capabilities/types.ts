import type { CapabilityDefinition, CapabilityProvideEntry, PluginType } from "../plugin-sdk";

export type CapabilitySource = "default" | "plugin";

export interface RegisterPluginCapabilitiesInput {
  pluginKey: string;
  pluginType: PluginType;
  provides?: CapabilityProvideEntry[];
  manifestPath?: string;
}

export interface CapabilityRegistrySnapshotItem {
  capability: CapabilityDefinition;
  providers: string[];
  source: CapabilitySource;
}

export interface CapabilityValidationResult {
  ok: boolean;
  errors: string[];
}
