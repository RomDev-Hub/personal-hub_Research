import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "fs";
import path from "path";

export interface HubConfigFile {
  telegram?: {
    botToken?: string;
    chatId?: string;
  };
  hub?: {
    cronSecret?: string;
  };
  updatedAt?: string;
}

export interface ConfigFieldView {
  key: string;
  label: string;
  envKey: string;
  masked: string;
  hasValue: boolean;
  source: "file" | "env" | "none";
  editable: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "hub-config.json");
const BACKUP_PATH = path.join(DATA_DIR, "hub-config.backup.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readHubConfigFile(): HubConfigFile {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as HubConfigFile;
  } catch {
    return {};
  }
}

function writeHubConfigFile(data: HubConfigFile): void {
  ensureDataDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function maskSecret(value: string | undefined, visibleChars = 2): string {
  if (!value?.trim()) return "—";
  const v = value.trim();
  if (v.length <= visibleChars * 2) return "*".repeat(Math.max(4, v.length));
  return `${v.slice(0, visibleChars)}${"*".repeat(8)}${v.slice(-visibleChars)}`;
}

function resolveField(
  fileVal: string | undefined,
  envVal: string | undefined,
): { value?: string; source: "file" | "env" | "none" } {
  if (fileVal?.trim()) return { value: fileVal.trim(), source: "file" };
  if (envVal?.trim()) return { value: envVal.trim(), source: "env" };
  return { source: "none" };
}

export function getTelegramConfig() {
  const file = readHubConfigFile();
  const token = resolveField(file.telegram?.botToken, process.env.TELEGRAM_BOT_TOKEN);
  const chatId = resolveField(file.telegram?.chatId, process.env.TELEGRAM_CHAT_ID);
  return {
    token: token.value,
    chatId: chatId.value != null ? String(chatId.value) : undefined,
  };
}

export function getHubCronSecret(): string | undefined {
  const file = readHubConfigFile();
  return resolveField(file.hub?.cronSecret, process.env.HUB_CRON_SECRET).value;
}

export function buildConfigFieldsView(): ConfigFieldView[] {
  const file = readHubConfigFile();
  const defs: {
    key: string;
    label: string;
    envKey: string;
    fileVal?: string;
    envVal?: string;
    editable: boolean;
  }[] = [
    {
      key: "telegram.botToken",
      label: "Telegram Bot Token",
      envKey: "TELEGRAM_BOT_TOKEN",
      fileVal: file.telegram?.botToken,
      envVal: process.env.TELEGRAM_BOT_TOKEN,
      editable: true,
    },
    {
      key: "telegram.chatId",
      label: "Telegram Chat ID",
      envKey: "TELEGRAM_CHAT_ID",
      fileVal: file.telegram?.chatId,
      envVal: process.env.TELEGRAM_CHAT_ID,
      editable: true,
    },
    {
      key: "hub.cronSecret",
      label: "Hub tick secret (tùy chọn)",
      envKey: "HUB_CRON_SECRET",
      fileVal: file.hub?.cronSecret,
      envVal: process.env.HUB_CRON_SECRET,
      editable: true,
    },
  ];

  return defs.map((d) => {
    const { value, source } = resolveField(d.fileVal, d.envVal);
    return {
      key: d.key,
      label: d.label,
      envKey: d.envKey,
      masked: maskSecret(value),
      hasValue: Boolean(value),
      source,
      editable: d.editable,
    };
  });
}

export function getConfigFieldsForSection(section: "telegram" | "api" | "hub"): ConfigFieldView[] {
  const all = buildConfigFieldsView();
  if (section === "telegram") {
    return all.filter((f) => f.key.startsWith("telegram."));
  }
  if (section === "hub") {
    return all.filter((f) => f.key.startsWith("hub."));
  }
  return [];
}

export function saveConfigField(key: string, value: string): HubConfigFile {
  ensureDataDir();
  if (existsSync(CONFIG_PATH)) {
    copyFileSync(CONFIG_PATH, BACKUP_PATH);
  }
  const file = readHubConfigFile();
  const trimmed = value.trim();

  if (key === "telegram.botToken") {
    file.telegram = { ...file.telegram, botToken: trimmed };
  } else if (key === "telegram.chatId") {
    file.telegram = { ...file.telegram, chatId: trimmed };
  } else if (key === "hub.cronSecret") {
    file.hub = { ...file.hub, cronSecret: trimmed };
  }

  file.updatedAt = new Date().toISOString();
  writeHubConfigFile(file);
  return file;
}

export function clearConfigField(key: string): HubConfigFile {
  ensureDataDir();
  if (existsSync(CONFIG_PATH)) {
    copyFileSync(CONFIG_PATH, BACKUP_PATH);
  }
  const file = readHubConfigFile();

  if (key === "telegram.botToken" && file.telegram) {
    delete file.telegram.botToken;
    if (!file.telegram.chatId) delete file.telegram;
  } else if (key === "telegram.chatId" && file.telegram) {
    delete file.telegram.chatId;
    if (!file.telegram.botToken) delete file.telegram;
  } else if (key === "hub.cronSecret" && file.hub) {
    delete file.hub.cronSecret;
    if (!Object.keys(file.hub).length) delete file.hub;
  }

  file.updatedAt = new Date().toISOString();
  writeHubConfigFile(file);
  return file;
}

export function restoreHubConfigFromBackup(): boolean {
  if (!existsSync(BACKUP_PATH)) return false;
  ensureDataDir();
  copyFileSync(BACKUP_PATH, CONFIG_PATH);
  return true;
}

export function clearAllFileOverrides(): void {
  if (existsSync(CONFIG_PATH)) {
    copyFileSync(CONFIG_PATH, BACKUP_PATH);
    writeFileSync(CONFIG_PATH, "{}", "utf-8");
  }
}

export function hasHubConfigBackup(): boolean {
  return existsSync(BACKUP_PATH);
}
