import type {
  SendOptions,
  StrategyOnlineOptions,
} from "../../../../core/plugin-sdk";

export type SystemPromptAction = "system.prompt.manager.get";

export interface SystemPromptGetInput {
  action?: SystemPromptAction;
  state?: unknown;
}

export type SystemPromptSendInput = SendOptions & SystemPromptGetInput;

export type SystemPromptOnlineOptions = StrategyOnlineOptions & {
  method?: unknown;
  promptDir?: unknown;
};
