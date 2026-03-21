import type { LlmStreamEmitter } from "./types";

export async function collectStreamReply(stream: LlmStreamEmitter): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];

    const onData = (content: unknown): void => {
      if (typeof content === "string") {
        chunks.push(content);
        return;
      }

      if (content === null || content === undefined) {
        return;
      }

      chunks.push(String(content));
    };

    const onError = (error: unknown): void => {
      cleanup();
      reject(error);
    };

    const onEnd = (): void => {
      cleanup();
      resolve(chunks.join(""));
    };

    const cleanup = (): void => {
      stream.off("data", onData);
      stream.off("error", onError);
      stream.off("end", onEnd);
    };

    stream.on("data", onData);
    stream.on("error", onError);
    stream.on("end", onEnd);
  });
}

