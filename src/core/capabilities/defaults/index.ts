import type { CapabilityDefinition } from "../../plugin-sdk";

import { systemDefaultCapabilities } from "./system";

export const defaultCapabilities: CapabilityDefinition[] = [
  ...systemDefaultCapabilities,
];
