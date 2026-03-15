import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function collectSourceFiles(rootPath: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const result: string[] = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (absolutePath.endsWith(".ts") || absolutePath.endsWith(".js")) {
        result.push(absolutePath);
      }
    }
  }

  return result;
}

describe("plugin source guard", () => {
  it("does not allow direct process.env usage in plugins", () => {
    const pluginRoots = [
      path.resolve(__dirname, "../../src/skillPlugins"),
      path.resolve(__dirname, "../../src/systemPlugins"),
    ];

    const sourceFiles = pluginRoots.flatMap((rootPath) => collectSourceFiles(rootPath));
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, "utf-8");
      if (/\bprocess\s*\.\s*env\b/.test(source)) {
        violations.push(path.relative(process.cwd(), filePath));
      }
    }

    expect(violations).toEqual([]);
  });
});
