// src/start/index.ts
import fs from "node:fs";
import path from "node:path";

import type { IPlugin, PluginManifest, OnlineOptions } from "./core/plugin-sdk";
import { 
    validateManifest, validateOnlineOptions,
    CoreErrorCode, makeError
} from "./core/plugin-sdk";

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

// 很粗暴但實用：從 argv 取 method 與 url/token/path
function parseOnlineOptions(argv: string[]): OnlineOptions {
  // 預設 local
  const options: Record<string, unknown> = { method: "local" };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--method") options.method = argv[i + 1];
    if (a === "--url") options.url = argv[i + 1];
    if (a === "--token") options.token = argv[i + 1];
    if (a === "--path") options.path = argv[i + 1];
  }

  return options as OnlineOptions;
}

async function main() {
  // 你可以改成從 argv 指定 plugin 路徑
  const pluginDir = path.resolve(process.cwd(), "dist" , "skillPlugins", "example");
  const manifestPath = path.join(pluginDir, "plugin.manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.error(`[start] manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = readJsonFile<PluginManifest>(manifestPath);

  // 1) validate manifest
  const m = validateManifest(manifest);
  if (!m.ok) {
    console.error("[start] manifest invalid:", m.error);
    process.exit(1);
  }

  // 2) load plugin entry
  const entryPath = path.resolve(pluginDir, manifest.meta.entry);
  let pluginModule: any;
  try {
    // CommonJS require
    pluginModule = require(entryPath);
  } catch (e) {
    console.error("[start] require entry failed:", e);
    process.exit(1);
  }

  const plugin: IPlugin = (pluginModule?.default ?? pluginModule) as IPlugin;
  if (!plugin?.online || !plugin?.offline) {
    console.error("[start] entry does not export a valid IPlugin");
    process.exit(1);
  }

  // 3) parse + validate options
  const options = parseOnlineOptions(process.argv.slice(2));
  const v = validateOnlineOptions(manifest, options);
  if (!v.ok) {
    console.error("[start] online options invalid:", v.error);
    process.exit(1);
  }

  // 4) online
  const res = await plugin.online(options);
  if (!res.ok) {
    console.error("[start] plugin online failed:", res.error);
    process.exit(1);
  }
  console.log("[start] plugin online ok");

  // 5) graceful shutdown
  const shutdown = async () => {
    console.log("[start] shutting down...");
    try {
      const off = await plugin.offline();
      if (!off.ok) console.error("[start] offline failed:", off.error);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("[start] fatal:", e ?? makeError(CoreErrorCode.ONLINE_FAILED, "fatal", e));
  process.exit(1);
});
