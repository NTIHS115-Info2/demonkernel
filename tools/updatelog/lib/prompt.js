"use strict";

const readline = require("node:readline");

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function question(text) {
    return new Promise((resolve) => {
      rl.question(text, (answer) => resolve(answer));
    });
  }

  async function askInput(config) {
    const promptText = buildPromptText(config.prompt, config.default);
    while (true) {
      const answer = (await question(promptText)).trim();
      const finalAnswer = answer || String(config.default || "").trim();

      if (config.required && !finalAnswer) {
        console.log("此欄位必填，請重新輸入。");
        continue;
      }

      if (config.validate) {
        const check = config.validate(finalAnswer);
        if (!check.ok) {
          console.log(check.error || "輸入不合法，請重新輸入。");
          continue;
        }
      }

      return finalAnswer;
    }
  }

  async function askSelect(config) {
    const choices = config.choices || [];
    if (!choices.length) {
      throw new Error(`選單題目缺少 choices: ${config.id}`);
    }

    console.log(`\n${config.prompt}`);
    for (let i = 0; i < choices.length; i += 1) {
      const c = choices[i];
      console.log(`  ${i + 1}. ${c.label}`);
    }

    const defaultIndex = Number.isInteger(config.defaultIndex)
      ? config.defaultIndex
      : 0;
    const promptText = `請輸入選項編號 (預設 ${defaultIndex + 1}): `;

    while (true) {
      const answer = (await question(promptText)).trim();
      const picked = answer ? Number(answer) : defaultIndex + 1;
      if (!Number.isInteger(picked) || picked < 1 || picked > choices.length) {
        console.log("選項不存在，請重新輸入。");
        continue;
      }

      return choices[picked - 1].value;
    }
  }

  async function askList(config) {
    const text = await askInput({
      id: config.id,
      prompt: `${config.prompt}（以 ; 分隔多筆）`,
      required: config.required,
      default: config.default,
      validate: config.validate,
    });

    return text
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function close() {
    rl.close();
  }

  return {
    askInput,
    askSelect,
    askList,
    close,
  };
}

function buildPromptText(text, defaultValue) {
  const defaultText =
    defaultValue !== undefined && String(defaultValue).trim()
      ? ` (預設: ${defaultValue})`
      : "";
  return `${text}${defaultText}: `;
}

module.exports = {
  isInteractive,
  createPrompt,
};
