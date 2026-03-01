"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const loggerRuntime = require("../index");

function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
}

describe("tools/logger", () => {
  let tempRoot = "";

  beforeEach(async () => {
    await loggerRuntime.__resetForTests();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "demonkernel-logger-"));
    loggerRuntime.configureLogger({
      rootDir: tempRoot,
      level: "info",
      console: {
        enabled: false,
      },
    });
  });

  afterEach(async () => {
    await loggerRuntime.shutdownLogger();
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("writes both .json and .log with redaction", async () => {
    const logger = loggerRuntime.getLogger("App Service");
    logger.info("token=abcdefghi");
    logger.info("user email", { email: "john@example.com" });

    await loggerRuntime.flushLogs();
    const sessionPath = loggerRuntime.getCurrentLogSessionPath();
    const textPath = path.join(sessionPath, "log", "app-service.log");
    const jsonPath = path.join(sessionPath, "json", "app-service.json");

    expect(fs.existsSync(textPath)).toBe(true);
    expect(fs.existsSync(jsonPath)).toBe(true);

    const textLines = readLines(textPath);
    const jsonLines = readLines(jsonPath).map((line) => JSON.parse(line));
    expect(textLines.length).toBeGreaterThanOrEqual(2);
    expect(jsonLines.length).toBeGreaterThanOrEqual(2);
    expect(textLines.join("\n")).toContain("abc******");
    expect(textLines.join("\n")).not.toContain("john@example.com");
    expect(JSON.stringify(jsonLines)).not.toContain("john@example.com");
  });

  it("applies level gate correctly", async () => {
    loggerRuntime.configureLogger({ level: "warn" });
    const logger = loggerRuntime.getLogger("gate");
    logger.info("skip info");
    logger.warn("keep warn");

    await loggerRuntime.flushLogs();
    const lines = readLines(
      path.join(loggerRuntime.getCurrentLogSessionPath(), "log", "gate.log")
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("WARN");
  });

  it("supports child logger bindings", async () => {
    const logger = loggerRuntime.getLogger("child-root").child({
      traceId: "trace-123",
      module: "sample",
    });

    logger.info("child log line");
    await loggerRuntime.flushLogs();

    const jsonLines = readLines(
      path.join(loggerRuntime.getCurrentLogSessionPath(), "json", "child-root.json")
    ).map((line) => JSON.parse(line));

    expect(jsonLines[0].bindings.traceId).toBe("trace-123");
    expect(jsonLines[0].bindings.module).toBe("sample");
  });

  it("serializes error records", async () => {
    const logger = loggerRuntime.getLogger("errors");
    const error = new Error("password=123456");
    error.code = "E_UNIT";
    logger.error(error, { step: "online" });

    await loggerRuntime.flushLogs();
    const jsonLine = readLines(
      path.join(loggerRuntime.getCurrentLogSessionPath(), "json", "errors.json")
    )
      .map((line) => JSON.parse(line))
      .at(-1);

    expect(jsonLine.level).toBe("error");
    expect(jsonLine.err.name).toBe("Error");
    expect(jsonLine.err.code).toBe("E_UNIT");
    expect(jsonLine.message).not.toContain("123456");
  });

  it("compresses previous sessions asynchronously into tar.gz", async () => {
    const oldSessionName = "2026-01-01T00-00-00-000Z-9999";
    const oldSessionPath = path.join(tempRoot, oldSessionName);
    fs.mkdirSync(path.join(oldSessionPath, "log"), { recursive: true });
    fs.mkdirSync(path.join(oldSessionPath, "json"), { recursive: true });
    fs.writeFileSync(path.join(oldSessionPath, "log", "legacy.log"), "legacy", "utf8");

    const logger = loggerRuntime.getLogger("compress-test");
    logger.info("trigger");

    await loggerRuntime.shutdownLogger();

    expect(fs.existsSync(oldSessionPath)).toBe(false);
    expect(fs.existsSync(`${oldSessionPath}.tar.gz`)).toBe(true);
  });

  it("flushes pending writes before shutdown", async () => {
    const logger = loggerRuntime.getLogger("shutdown");
    logger.info("line-before-shutdown");

    await loggerRuntime.shutdownLogger();

    const sessionDirs = fs
      .readdirSync(tempRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    expect(sessionDirs.length).toBe(1);

    const textPath = path.join(tempRoot, sessionDirs[0].name, "log", "shutdown.log");
    const textLines = readLines(textPath);
    expect(textLines.join("\n")).toContain("line-before-shutdown");
  });
});
