import { describe, expect, it } from "vitest";

import {
  composePromptContent,
  composePromptMessages,
} from "../../src/systemPlugins/talk-engine/strategies/local/promptComposer";

describe("talk-engine local promptComposer", () => {
  it("composes prompt content from message only when talker is missing", () => {
    const content = composePromptContent({
      message: "hello world",
      talker: null,
    });

    expect(content).toBe("hello world");
  });

  it("composes prompt content with sender prefix when talker exists", () => {
    const content = composePromptContent({
      message: "hi there",
      talker: "tester",
    });

    expect(content).toBe("<sender=tester>: hi there");
  });

  it("returns a single user message and does not include unrelated fields", () => {
    const messages = composePromptMessages({
      message: "ping",
      talker: "owner",
    });

    expect(messages).toEqual([
      {
        role: "user",
        content: "<sender=owner>: ping",
      },
    ]);
    expect(messages).toHaveLength(1);
    expect(Object.keys(messages[0] ?? {})).toEqual(["role", "content"]);
  });

  it("prepends sanitized history messages before current user message", () => {
    const messages = composePromptMessages({
      message: "current",
      talker: null,
      historyMessages: [
        { role: "system", content: "system-note", timestamp: 1 },
        { role: "assistant", content: "previous-reply", timestamp: 2 },
        { role: "tool", content: "", timestamp: 3 },
      ],
    });

    expect(messages).toEqual([
      { role: "system", content: "system-note" },
      { role: "assistant", content: "previous-reply" },
      { role: "user", content: "current" },
    ]);
  });
});
