export const METHOD_LOCAL = "local" as const;

export const HISTORY_ACTION_APPEND = "history.append";
export const HISTORY_ACTION_RECENT = "history.recent";
export const HISTORY_ACTION_CLEAR = "history.clear";

export const HISTORY_ACTION_ALIAS_TO_OPERATION: Readonly<Record<string, "append" | "recent" | "clear">> = Object.freeze({
  [HISTORY_ACTION_APPEND]: "append",
  [HISTORY_ACTION_RECENT]: "recent",
  [HISTORY_ACTION_CLEAR]: "clear",
  "system.conversation.history.append": "append",
  "system.conversation.history.recent": "recent",
  "system.conversation.history.clear": "clear",
});

export const DEFAULT_MAX_MESSAGES = 100;
export const DEFAULT_EXPIRE_DAYS = 7;
export const DEFAULT_BACKUP_COUNT = 3;
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;
