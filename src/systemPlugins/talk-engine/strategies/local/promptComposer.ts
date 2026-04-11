import type {
  HistoryPromptMessage,
  NormalizedTalkInput,
  TalkPromptMessage,
} from "./types";

type PromptComposerInput = Pick<NormalizedTalkInput, "message" | "talker"> & {
  historyMessages?: HistoryPromptMessage[];
};

function isPromptRole(value: unknown): value is TalkPromptMessage["role"] {
  return value === "system" || value === "user" || value === "assistant" || value === "tool";
}

function normalizeHistoryMessages(historyMessages: HistoryPromptMessage[] | undefined): TalkPromptMessage[] {
  if (!historyMessages || historyMessages.length === 0) {
    return [];
  }

  const normalized: TalkPromptMessage[] = [];
  for (const message of historyMessages) {
    if (!message || !isPromptRole(message.role)) {
      continue;
    }
    if (typeof message.content !== "string" || message.content.length === 0) {
      continue;
    }

    normalized.push({
      role: message.role,
      content: message.content,
    });
  }

  return normalized;
}

export function composePromptContent(input: PromptComposerInput): string {
  if (input.talker) {
    return `<sender=${input.talker}>: ${input.message}`;
  }

  return input.message;
}

export function composePromptMessages(input: PromptComposerInput): TalkPromptMessage[] {
  const history = normalizeHistoryMessages(input.historyMessages);
  return [
    ...history,
    {
      role: "user",
      content: composePromptContent(input),
    },
  ];
}
