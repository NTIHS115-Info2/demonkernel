import { SecretsManager } from "./manager";

export * from "./types";
export * from "./errors";
export * from "./manager";
export * from "./schema/secretKeys";

const secretsManager = new SecretsManager();

export default secretsManager;
