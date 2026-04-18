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

function readJsonLines(filePath) {
  return readLines(filePath).map((line) => JSON.parse(line));
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

  it("buffers raw diagnostic logs in success path and clears without export", async () => {
    const logger = loggerRuntime.getLogger("obs-success");
    logger.info("raw-stream-chunk", {
      observability: {
        kind: "raw",
        requestId: "req-success",
        eventType: "stream.chunk",
      },
      chunk: "hello world",
    });
    logger.info("request complete", {
      observability: {
        kind: "node",
        requestId: "req-success",
        outcome: "success",
      },
    });

    await loggerRuntime.flushLogs();
    const sessionPath = loggerRuntime.getCurrentLogSessionPath();
    const jsonPath = path.join(sessionPath, "json", "obs-success.json");
    const jsonLines = readJsonLines(jsonPath);

    expect(jsonLines.some((line) => line.message === "raw-stream-chunk")).toBe(false);
    expect(
      jsonLines.some(
        (line) => line.message === "diagnostic context export begin"
      )
    ).toBe(false);
    expect(jsonLines.some((line) => line.message === "request complete")).toBe(true);
  });

  it("exports only latest N raw traces on error outcome", async () => {
    loggerRuntime.configureLogger({
      observability: {
        diagnosticRingSize: 2,
      },
    });
    const logger = loggerRuntime.getLogger("obs-error");
    logger.info("raw-1", {
      observability: { kind: "raw", requestId: "req-error", eventType: "chunk" },
      chunk: "one",
    });
    logger.info("raw-2", {
      observability: { kind: "raw", requestId: "req-error", eventType: "chunk" },
      chunk: "two",
    });
    logger.info("raw-3", {
      observability: { kind: "raw", requestId: "req-error", eventType: "chunk" },
      chunk: "three",
    });
    logger.error("request failed", {
      observability: { kind: "node", requestId: "req-error", outcome: "error" },
    });

    await loggerRuntime.flushLogs();
    const sessionPath = loggerRuntime.getCurrentLogSessionPath();
    const jsonPath = path.join(sessionPath, "json", "obs-error.json");
    const jsonLines = readJsonLines(jsonPath);
    const traceLines = jsonLines.filter(
      (line) => line?.meta?.action === "diagnostic.export.trace"
    );
    const traceMessages = traceLines.map((line) => line?.meta?.trace?.message?.preview);

    expect(
      jsonLines.some((line) => line.message === "diagnostic context export begin")
    ).toBe(true);
    expect(traceLines).toHaveLength(2);
    expect(traceMessages).toContain("raw-2");
    expect(traceMessages).toContain("raw-3");
    expect(traceMessages).not.toContain("raw-1");
  });

  it("exports raw traces on abort and timeout outcomes", async () => {
    const logger = loggerRuntime.getLogger("obs-timeout-abort");
    logger.info("raw-abort", {
      observability: { kind: "raw", requestId: "req-abort", eventType: "chunk" },
      chunk: "abort-me",
    });
    logger.warn("request aborted", {
      observability: { kind: "node", requestId: "req-abort", outcome: "abort" },
    });

    logger.info("raw-timeout", {
      observability: { kind: "raw", requestId: "req-timeout", eventType: "chunk" },
      chunk: "timeout-me",
    });
    logger.error("request timeout", {
      observability: { kind: "node", requestId: "req-timeout", outcome: "timeout" },
    });

    await loggerRuntime.flushLogs();
    const sessionPath = loggerRuntime.getCurrentLogSessionPath();
    const jsonPath = path.join(sessionPath, "json", "obs-timeout-abort.json");
    const jsonLines = readJsonLines(jsonPath);
    const exportBeginLines = jsonLines.filter(
      (line) => line.message === "diagnostic context export begin"
    );
    const triggerSet = new Set(exportBeginLines.map((line) => line.meta?.trigger));

    expect(triggerSet.has("abort")).toBe(true);
    expect(triggerSet.has("timeout")).toBe(true);
  });

  it("writes raw events directly when rawDirectExport is enabled", async () => {
    loggerRuntime.configureLogger({
      observability: {
        rawDirectExport: true,
      },
    });
    const logger = loggerRuntime.getLogger("obs-direct");
    logger.info("raw-direct", {
      observability: {
        kind: "raw",
        requestId: "req-direct",
        eventType: "chunk",
      },
      chunk: "direct-content",
    });

    await loggerRuntime.flushLogs();
    const sessionPath = loggerRuntime.getCurrentLogSessionPath();
    const jsonPath = path.join(sessionPath, "json", "obs-direct.json");
    const jsonLines = readJsonLines(jsonPath);

    expect(jsonLines.some((line) => line.message === "raw-direct")).toBe(true);
    expect(
      jsonLines.some((line) => line.message === "diagnostic context export begin")
    ).toBe(false);
  });

  it("forces raw direct export when LOG_STREAM_RAW=true", async () => {
    const previous = process.env.LOG_STREAM_RAW;
    try {
      process.env.LOG_STREAM_RAW = "true";
      loggerRuntime.configureLogger({
        observability: {
          rawDirectExport: false,
        },
      });

      const logger = loggerRuntime.getLogger("obs-env-direct");
      logger.info("raw-env-direct", {
        observability: {
          kind: "raw",
          requestId: "req-env-direct",
          eventType: "chunk",
        },
        chunk: "direct-by-env",
      });

      await loggerRuntime.flushLogs();
      const sessionPath = loggerRuntime.getCurrentLogSessionPath();
      const jsonPath = path.join(sessionPath, "json", "obs-env-direct.json");
      const jsonLines = readJsonLines(jsonPath);

      expect(jsonLines.some((line) => line.message === "raw-env-direct")).toBe(true);
      expect(
        jsonLines.some((line) => line.message === "diagnostic context export begin")
      ).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.LOG_STREAM_RAW;
      } else {
        process.env.LOG_STREAM_RAW = previous;
      }
    }
  });
});
