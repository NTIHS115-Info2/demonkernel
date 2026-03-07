import { CapabilitiesManager } from "./manager";

export * from "./types";
export * from "./errors";
export * from "./validator";
export * from "./manager";
export * from "./defaults";

const capabilitiesManager = new CapabilitiesManager();

export default capabilitiesManager;
