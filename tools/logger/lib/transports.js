"use strict";

const fs = require("node:fs");
const path = require("node:path");

function sanitizeLoggerName(name) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "app";
}

class QueuedWriter {
  constructor(stream, onError) {
    this.stream = stream;
    this.onError = onError;
    this.queue = Promise.resolve();
    this.closed = false;

    this.stream.on("error", (error) => {
      this.onError(error);
    });
  }

  write(line) {
    if (this.closed) {
      return;
    }

    this.queue = this.queue
      .then(
        () =>
          new Promise((resolve) => {
            if (!this.stream.writable || this.stream.destroyed) {
              resolve();
              return;
            }

            this.stream.write(line, "utf8", () => {
              resolve();
            });
          })
      )
      .catch((error) => {
        this.onError(error);
      });
  }

  async flush() {
    await this.queue.catch((error) => {
      this.onError(error);
    });
  }

  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.flush();
    await new Promise((resolve) => {
      if (!this.stream.writable || this.stream.writableEnded || this.stream.destroyed) {
        resolve();
        return;
      }
      this.stream.end(resolve);
    });
  }
}

function createTransportFactory(params) {
  const { sessionPath, onError } = params;
  const transportMap = new Map();
  const logDir = path.join(sessionPath, "log");
  const jsonDir = path.join(sessionPath, "json");

  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(jsonDir, { recursive: true });

  function getTransport(name) {
    const safeName = sanitizeLoggerName(name);
    if (transportMap.has(safeName)) {
      return transportMap.get(safeName);
    }

    const textPath = path.join(logDir, `${safeName}.log`);
    const jsonPath = path.join(jsonDir, `${safeName}.json`);
    const textStream = fs.createWriteStream(textPath, { flags: "a" });
    const jsonStream = fs.createWriteStream(jsonPath, { flags: "a" });

    const transport = {
      textWriter: new QueuedWriter(textStream, (error) =>
        onError(error, { logger: safeName, filePath: textPath })
      ),
      jsonWriter: new QueuedWriter(jsonStream, (error) =>
        onError(error, { logger: safeName, filePath: jsonPath })
      ),
    };

    transportMap.set(safeName, transport);
    return transport;
  }

  function write(name, payload) {
    const transport = getTransport(name);
    transport.textWriter.write(`${payload.textLine}\n`);
    transport.jsonWriter.write(`${payload.jsonLine}\n`);
  }

  async function flushAll() {
    await Promise.all(
      Array.from(transportMap.values()).flatMap((transport) => [
        transport.textWriter.flush(),
        transport.jsonWriter.flush(),
      ])
    );
  }

  async function closeAll() {
    await Promise.all(
      Array.from(transportMap.values()).flatMap((transport) => [
        transport.textWriter.close(),
        transport.jsonWriter.close(),
      ])
    );
  }

  return {
    write,
    flushAll,
    closeAll,
    sanitizeLoggerName,
  };
}

module.exports = {
  createTransportFactory,
  sanitizeLoggerName,
};
