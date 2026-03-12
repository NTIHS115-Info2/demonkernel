import capabilitiesManager from "../capabilities";

import { CapabilityRegistry } from "./manager";

export * from "./types";
export * from "./errors";
export * from "./manager";

const capabilityRegistry = new CapabilityRegistry({
  capabilitiesManager,
});

export default capabilityRegistry;
