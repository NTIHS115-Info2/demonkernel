#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { createPrompt, isInteractive } = require("./lib/prompt");
const { parseVersion } = require("./lib/version");
const {
  buildMainUpdatePath,
  buildPluginUpdatePath,
  isUpdateMarkdownPath,
  slugifyPluginName,
} = require("./lib/path");
const { renderUpdateLog } = require("./lib/markdown");
const { validateUpdateFiles } = require("./lib/validate");
const {
  getCurrentBranch,
  getShortCommit,
  getStagedFiles,
  stageFile,
  getUpstreamRange,
  getChangedFilesInRange,
  isGitRepo,
} = require("./lib/git");

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(__dirname, "templates");
const MANUAL_PLUGIN_VALUE = "__manual_plugin_name__";

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || flags.help) {
    printHelp();
    return;
  }

  if (command === "new") {
    const created = await createNewLog({
      repoRoot: ROOT,
      flags,
      shouldStage: false,
      mustBeInteractive: false,
    });
    console.log(`[updatelog] 已生成: ${created.relativePath}`);
    return;
  }

  if (command === "ensure") {
    await ensureForStaged({
      repoRoot: ROOT,
      flags,
    });
    return;
  }

  if (command === "validate") {
    const mode = flags.push ? "push" : "staged";
    const validation = validateMode({
      repoRoot: ROOT,
      mode,
    });
    if (!validation.ok) {
      printValidationErrors(validation);
      process.exitCode = 1;
      return;
    }
    console.log(`[updatelog] validate(${mode}) 通過`);
    return;
  }

  throw new Error(`未知指令: ${command}`);
}

async function createNewLog(options) {
  const repoRoot = options.repoRoot;
  const flags = options.flags || {};
  const interactive = isInteractive();
  const prompt = interactive ? createPrompt() : null;

  try {
    const registry = loadJson(path.join(TEMPLATES_DIR, "registry.json"));
    const category = await resolveCategory(registry, flags, prompt, interactive);
    const template = loadTemplateByCategory(registry, category);

    const pluginIndex = scanPlugins(repoRoot);
    const answers = await collectAnswers({
      template,
      flags,
      prompt,
      interactive,
      pluginIndex,
    });

    const versionCheck = parseVersion(answers.version);
    if (!versionCheck.ok) {
      throw new Error(versionCheck.error);
    }

    let outputRelativePath = buildOutputPath(category, answers);
    let outputAbsolutePath = path.resolve(repoRoot, outputRelativePath);

    while (fs.existsSync(outputAbsolutePath) && !flags.force) {
      if (!interactive || options.mustBeInteractive) {
        throw new Error(
          `版本檔已存在: ${outputRelativePath}。請改版本號或使用 --force。`
        );
      }

      const overwriteAction = await prompt.askSelect({
        id: "existingVersionAction",
        prompt: `版本檔已存在 (${outputRelativePath})，請選擇處理方式`,
        choices: [
          { label: "覆寫既有檔案", value: "overwrite" },
          { label: "改用新的版本號", value: "newVersion" },
        ],
      });

      if (overwriteAction === "overwrite") break;

      answers.version = await prompt.askInput({
        id: "version",
        prompt: "請輸入新的版本號 (x.y.z)",
        required: true,
        validate: toPromptValidation(parseVersion),
      });
      outputRelativePath = buildOutputPath(category, answers);
      outputAbsolutePath = path.resolve(repoRoot, outputRelativePath);
    }

    const payload = buildPayload(category, answers, repoRoot);
    const markdown = renderUpdateLog(payload);

    fs.mkdirSync(path.dirname(outputAbsolutePath), { recursive: true });
    fs.writeFileSync(outputAbsolutePath, markdown, "utf8");

    if (options.shouldStage) {
      const staged = stageFile(outputRelativePath, repoRoot);
      if (!staged.ok) {
        throw new Error(`無法將 UpdateLog 加入 staged: ${staged.error}`);
      }
    }

    return {
      relativePath: outputRelativePath.replace(/\\/g, "/"),
      absolutePath: outputAbsolutePath,
      payload,
    };
  } finally {
    if (prompt) prompt.close();
  }
}

async function collectAnswers(params) {
  const answers = {};
  const template = params.template;
  const flags = params.flags || {};
  const prompt = params.prompt;
  const interactive = params.interactive;
  const pluginIndex = params.pluginIndex || [];

  for (const question of template.questions || []) {
    const flagValue = readFlagValue(question.id, flags);
    if (flagValue !== undefined) {
      answers[question.id] = normalizeAnswerFromFlag(question, flagValue);
      continue;
    }

    if (!interactive) {
      throw new Error(`非互動模式缺少必要參數: --${toKebab(question.id)}`);
    }

    if (question.type === "input") {
      answers[question.id] = await prompt.askInput({
        id: question.id,
        prompt: question.prompt,
        required: question.required,
        default: question.default,
        validate: question.id === "version" ? toPromptValidation(parseVersion) : null,
      });
      continue;
    }

    if (question.type === "list") {
      answers[question.id] = await prompt.askList({
        id: question.id,
        prompt: question.prompt,
        required: question.required,
        default: question.default,
      });
      continue;
    }

    if (question.type === "select") {
      const choices = resolveDynamicChoices(question, answers, pluginIndex);
      answers[question.id] = await prompt.askSelect({
        id: question.id,
        prompt: question.prompt,
        choices,
      });
      continue;
    }

    if (question.type === "select-or-input") {
      const choices = resolveDynamicChoices(question, answers, pluginIndex);
      const picked = await prompt.askSelect({
        id: question.id,
        prompt: question.prompt,
        choices,
      });
      if (picked === MANUAL_PLUGIN_VALUE) {
        answers[question.id] = await prompt.askInput({
          id: question.id,
          prompt: "請手動輸入插件名稱",
          required: true,
        });
      } else {
        answers[question.id] = picked;
      }
      continue;
    }
  }

  if (!answers.version) {
    throw new Error("缺少 version");
  }

  return answers;
}

async function resolveCategory(registry, flags, prompt, interactive) {
  const direct = readFlagValue("category", flags);
  if (direct) return String(direct).trim().toLowerCase();

  if (!interactive) {
    throw new Error("非互動模式缺少必要參數: --category");
  }

  const categories = (registry.categories || []).map((item) => ({
    label: item.label,
    value: item.id,
  }));

  return prompt.askSelect({
    id: "category",
    prompt: "請選擇 UpdateLog 類別",
    choices: categories,
  });
}

function buildOutputPath(category, answers) {
  if (category === "main") {
    const result = buildMainUpdatePath(answers.version);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  const result = buildPluginUpdatePath(
    answers.pluginType,
    answers.pluginName,
    answers.version
  );
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function buildPayload(category, answers, repoRoot) {
  const pluginSlug =
    category === "plugin" ? slugifyPluginName(answers.pluginName) : "";

  return {
    category,
    scope: category === "main" ? "Main" : `${answers.pluginType}/${pluginSlug}`,
    version: answers.version,
    date: formatLocalDate(),
    branch: isGitRepo(repoRoot) ? getCurrentBranch(repoRoot) : "unknown",
    commit: isGitRepo(repoRoot) ? getShortCommit(repoRoot) : "unknown",
    summary: ensureList(answers.summary),
    changes: {
      added: ensureList(answers.added),
      changed: ensureList(answers.changed),
      fixed: ensureList(answers.fixed),
      removed: ensureList(answers.removed),
    },
    impact: ensureList(answers.impact),
    tests: ensureList(answers.tests),
    risksRollback: ensureList(answers.risksRollback),
    notes: ensureList(answers.notes),
  };
}

async function ensureForStaged(options) {
  const repoRoot = options.repoRoot;
  const flags = options.flags || {};
  const stagedFiles = getStagedFiles(repoRoot);

  if (!stagedFiles.length) {
    console.log("[updatelog] staged 無變更，略過");
    return;
  }

  const updateFiles = stagedFiles.filter(isUpdateMarkdownPath);
  const nonUpdateFiles = stagedFiles.filter((item) => !isUpdateMarkdownPath(item));

  if (!nonUpdateFiles.length) {
    console.log("[updatelog] staged 僅包含 Updates，略過 ensure");
    return;
  }

  if (updateFiles.length) {
    const validation = validateUpdateFiles(updateFiles, repoRoot);
    if (!validation.ok) {
      printValidationErrors(validation);
      throw new Error("staged UpdateLog 驗證失敗");
    }
    console.log("[updatelog] staged 已有合規 UpdateLog");
    return;
  }

  if (!isInteractive()) {
    throw new Error(
      "偵測到非 Updates 變更但無 UpdateLog。請先手動執行 `yarn updatelog:new` 後再提交。"
    );
  }

  const created = await createNewLog({
    repoRoot,
    flags,
    shouldStage: true,
    mustBeInteractive: true,
  });

  console.log(`[updatelog] ensure 已建立並加入 staged: ${created.relativePath}`);
}

function validateMode(options) {
  const repoRoot = options.repoRoot;
  const mode = options.mode;

  const files =
    mode === "push"
      ? getPushChangedFiles(repoRoot)
      : getStagedFiles(repoRoot);

  if (!files.length) {
    return { ok: true, errors: [], details: [] };
  }

  const updateFiles = files.filter(isUpdateMarkdownPath);
  const nonUpdateFiles = files.filter((item) => !isUpdateMarkdownPath(item));

  if (nonUpdateFiles.length && !updateFiles.length) {
    return {
      ok: false,
      errors: [
        {
          filePath: "(none)",
          errors: ["偵測到非 Updates 變更，但未包含任何 UpdateLog 檔案"],
        },
      ],
      details: [],
    };
  }

  if (!updateFiles.length) {
    return { ok: true, errors: [], details: [] };
  }

  return validateUpdateFiles(updateFiles, repoRoot);
}

function getPushChangedFiles(repoRoot) {
  const range = getUpstreamRange(repoRoot);
  if (!range.ok) {
    return getChangedFilesInRange("", repoRoot);
  }
  return getChangedFilesInRange(range.value, repoRoot);
}

function printValidationErrors(result) {
  console.error("[updatelog] 驗證失敗:");
  for (const item of result.errors || []) {
    console.error(`- ${item.filePath}`);
    for (const error of item.errors || []) {
      console.error(`  - ${error}`);
    }
  }
}

function resolveDynamicChoices(question, answers, pluginIndex) {
  if (question.choicesSource === "pluginTypes") {
    return [
      { label: "skill", value: "skill" },
      { label: "system", value: "system" },
    ];
  }

  if (question.choicesSource === "pluginNames") {
    const pluginType = answers.pluginType;
    const list = pluginIndex.filter((item) => item.type === pluginType);

    const mapped = list.map((item) => ({
      label: `${item.displayName} (${item.dirName})`,
      value: item.dirName,
    }));

    mapped.push({
      label: "手動輸入插件名稱",
      value: MANUAL_PLUGIN_VALUE,
    });
    return mapped;
  }

  return (question.choices || []).map((item) => ({
    label: item.label,
    value: item.value,
  }));
}

function scanPlugins(repoRoot) {
  const results = [];
  for (const type of ["skill", "system"]) {
    const base = path.join(repoRoot, "src", `${type}Plugins`);
    if (!fs.existsSync(base)) continue;

    const dirs = fs.readdirSync(base, { withFileTypes: true });
    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const dirName = dirent.name;
      const manifestPath = path.join(base, dirName, "plugin.manifest.json");
      let displayName = dirName;

      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = loadJson(manifestPath);
          if (manifest && manifest.meta && manifest.meta.name) {
            displayName = String(manifest.meta.name);
          }
        } catch (_) {
          // ignore invalid manifest in plugin list
        }
      }

      results.push({
        type,
        dirName: slugifyPluginName(dirName) || dirName,
        displayName,
      });
    }
  }
  return results;
}

function loadTemplateByCategory(registry, category) {
  const item = (registry.categories || []).find((entry) => entry.id === category);
  if (!item) {
    throw new Error(`不支援的 category: ${category}`);
  }
  return loadJson(path.join(TEMPLATES_DIR, item.template));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { command, flags };
}

function readFlagValue(id, flags) {
  const key = toKebab(id);
  const direct = flags[key];
  if (direct !== undefined) return direct;

  if (id === "risksRollback" && flags.risks !== undefined) return flags.risks;
  return undefined;
}

function normalizeAnswerFromFlag(question, value) {
  if (question.type === "list") {
    return String(value)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(value).trim();
}

function ensureList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toKebab(value) {
  return String(value)
    .replace(/[A-Z]/g, (v) => `-${v.toLowerCase()}`)
    .replace(/^-/, "");
}

function toPromptValidation(checker) {
  return (input) => {
    const result = checker(input);
    if (result.ok) return { ok: true };
    return { ok: false, error: result.error || "輸入不合法" };
  };
}

function formatLocalDate(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function printHelp() {
  console.log(`
UpdateLog CLI

用法:
  node tools/updatelog/cli.js new [--category main|plugin] [--plugin-type skill|system] [--plugin-name <name>] [--version x.y.z] [--force]
  node tools/updatelog/cli.js ensure --staged
  node tools/updatelog/cli.js validate --staged|--push

常用參數:
  --summary "..."
  --added "item1;item2"
  --changed "item1;item2"
  --fixed "item1;item2"
  --removed "item1;item2"
  --impact "item1;item2"
  --tests "item1;item2"
  --risks "item1;item2"
  --notes "item1;item2"
`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[updatelog] ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = {
  createNewLog,
  ensureForStaged,
  validateMode,
  parseArgs,
  scanPlugins,
};

