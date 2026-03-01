"use strict";

const fs = require("node:fs");
const path = require("node:path");

function buildSessionName(date = new Date(), pid = process.pid) {
  return `${date.toISOString().replace(/[:.]/g, "-")}-${pid}`;
}

function ensureLogRoot(rootDir) {
  fs.mkdirSync(rootDir, { recursive: true });
}

function createLogSession(rootDir) {
  ensureLogRoot(rootDir);
  const sessionName = buildSessionName();
  const sessionPath = path.join(rootDir, sessionName);
  fs.mkdirSync(sessionPath, { recursive: true });
  return { sessionName, sessionPath };
}

module.exports = {
  buildSessionName,
  ensureLogRoot,
  createLogSession,
};
