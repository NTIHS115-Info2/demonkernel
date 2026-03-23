import type { NormalizedTalkInput, TalkPromptMessage } from "./types";

type PromptComposerInput = Pick<NormalizedTalkInput, "message" | "talker">;

export function composePromptContent(input: PromptComposerInput): string {
  if (input.talker) {
    return `<sender=${input.talker}>: ${input.message}`;
  }

  return input.message;
}

export function composePromptMessages(input: PromptComposerInput): TalkPromptMessage[] {
  return [
    {
      role: "user",
      content: composePromptContent(input),
    },
  ];
}
