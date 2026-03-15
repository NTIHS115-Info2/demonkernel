/**
 * 將 SSE buffer 依換行切成完整行與殘餘片段
 * Split SSE buffer into complete lines and remaining tail.
 */
export function splitSseLines(buffer: string): { lines: string[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  return { lines, rest };
}

/**
 * 只取 `data:` 行內容；非 data 行直接忽略
 * Extract payload from `data:` lines, ignore the rest.
 */
export function extractSseData(line: string): string | null {
  if (!line.startsWith("data:")) {
    return null;
  }

  const content = line.replace(/^data:\s*/, "").trim();
  if (content.length === 0) {
    return null;
  }

  return content;
}
