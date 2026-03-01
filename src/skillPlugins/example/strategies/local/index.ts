import type {
  SendOptions,
  StateResult,
  StrategyOnlineOptions,
  StrategyRestartOptions,
} from "@core/plugin-sdk";
import { createKernelLogger } from "@core/logger";

let online = false;
const logger = createKernelLogger("plugin-example-skill-local", {
  plugin: "example",
  type: "skill",
  strategy: "local",
});

export = {
  method: "local" as const,

  async online(options: StrategyOnlineOptions): Promise<void> {
    logger.info("example plugin(local) online with options", { options });
    online = true;
  },

  async offline(): Promise<void> {
    logger.info("example plugin(local) offline");
    online = false;
  },

  async restart(options: StrategyRestartOptions): Promise<void> {
    await this.offline();
    await this.online(options);
    logger.info("example plugin(local) restart with options", { options });
  },

  async state(): Promise<StateResult> {
    return { status: online ? 1 : 0 };
  },

  async send(options: SendOptions): Promise<unknown> {
    logger.info("example plugin(local) send with options", { options });
    return undefined;
  },
};
