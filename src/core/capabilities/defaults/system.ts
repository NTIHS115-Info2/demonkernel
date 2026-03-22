import type { CapabilityDefinition } from "../../plugin-sdk";

export const systemDefaultCapabilities: CapabilityDefinition[] = [
  {
    id: "system.echo.message",
    displayName: "System Echo Message",
    description: "Echoes an input message and returns the active runtime method.",
    version: "2.0.0",
    input: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Source message that the plugin should echo back.",
        },
      },
      required: ["message"],
      additionalProperties: true,
    },
    output: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description: "Echoed message from the plugin.",
        },
        method: {
          type: "string",
          enum: ["local", "remote"],
          description: "Runtime method that handled the request.",
        },
      },
      required: ["reply", "method"],
      additionalProperties: false,
    },
    testCases: [
      {
        id: "echo-basic-local",
        description: "Basic message payload should return the same message.",
        input: {
          message: "hello capability",
        },
        expectedOutput: {
          reply: "hello capability",
          method: "local",
        },
      },
      {
        id: "echo-missing-message",
        description: "Payload without message should throw.",
        input: {
          text: "missing message field",
        },
        expectError: true,
      },
    ],
  },
];
