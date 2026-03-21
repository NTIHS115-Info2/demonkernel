import type { TalkAction, TalkActionInput } from "./types";

export const METHOD_LOCAL = "local" as const;

export const TALK_ACTION_ALIAS_TO_ACTION: Readonly<Record<TalkActionInput, TalkAction>> = Object.freeze({
  "talk.nostream": "talk.nostream",
  "talk.stream": "talk.stream",
  "system.talk.engine.nostream": "talk.nostream",
  "system.talk.engine.stream": "talk.stream",
});

export const CAPABILITY_LLM_CHAT_STREAM = "system.llm.remote.chat.stream";
export const CAPABILITY_DISCORD_STREAM = "system.discord.conversation.stream";
export const CAPABILITY_DISCORD_SEND = "system.discord.message.send";
export const CAPABILITY_DISCORD_TYPING_START = "system.discord.typing.start";
export const CAPABILITY_DISCORD_TYPING_STOP = "system.discord.typing.stop";

export const DEFAULT_RELAY_ENABLED = true;
export const DEFAULT_RELAY_ERROR_REPLY = "目前無法回覆，請稍後再試。";

