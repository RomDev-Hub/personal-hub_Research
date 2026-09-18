import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { buildRegistryTemplateVars } from "./api-variable-registry";
import { buildDataSourceTemplateVars } from "./data-sources/resolve";
import {
  buildDetailedMarketText,
  buildHelpTextFromCommands,
  buildMarketDigestText,
  buildNewsSnippetText,
} from "./telegram-content";
import { fetchForex, vndPerUsd } from "./forex";
import { fetchMetalSpots } from "./metals";
import { fetchNewsFromFeeds } from "./news";
import type { NewsItem } from "./types";
import {
  getDefaultReplyTemplate,
  REPLY_TEMPLATES,
  type ReplyBuiltinKind,
} from "./telegram-reply-templates";

export type { ReplyBuiltinKind };

export interface TelegramReplyCommand {
  id: string;
  label: string;
  enabled: boolean;
  /** Lệnh Telegram, vd /market — khớp từ đầu câu */
  commands: string[];
  /** Từ khóa trong câu, vd "giá vàng" */
  keywords: string[];
  kind: ReplyBuiltinKind;
  /** kind=custom: nội dung HTML đầy đủ. kind=builtin: tùy chọn thay thế hoàn toàn nếu không rỗng */
  template?: string;
  prefixTemplate?: string;
  suffixTemplate?: string;
  /** Khi enabled=false và user gửi đúng cú pháp lệnh này */
  disabledReply?: string;
}

export interface SavedMessageTemplate {
  id: string;
  name: string;
  createdAt: string;
  commands: TelegramReplyCommand[];
  defaultDisabledReply?: string;
  unknownReply?: string;
}

export interface TelegramRepliesFile {
  commands: TelegramReplyCommand[];
  defaultDisabledReply?: string;
  unknownReply?: string;
  savedTemplates?: SavedMessageTemplate[];
  updatedAt?: string;
}

export interface MatchResult {
  command: TelegramReplyCommand;
  matchedBy: "command" | "keyword";
  matchedValue: string;
}

const REPLIES_PATH = path.join(process.cwd(), "data", "telegram-replies.json");

export const REPLY_VARIABLE_HINTS = [
  "{{gold}}",
  "{{silver}}",
  "{{usdVnd}}",
  "{{goldVnd}}",
  "{{eurUsd}}",
  "{{headline}}",
  "{{newsList}}",
  "{{helpList}}",
  "{{updatedAt}}",
  "{{command}}",
  "{{label}}",
  "{{body}}",
];

export { REPLY_TEMPLATES, getDefaultReplyTemplate };

const DEFAULT_DISABLED =
  "⏸ Lệnh <b>{{command}}</b> (<i>{{label}}</i>) đang tắt. Bật trong Cài đặt → Telegram → Cấu hình nội dung tin nhắn.";

const DEFAULT_UNKNOWN =
  "Mình chưa hiểu câu này. Gõ <b>/help</b> để xem lệnh đang bật.";

function commandWithDefaultTemplate(
  base: Omit<TelegramReplyCommand, "template"> & { template?: string },
): TelegramReplyCommand {
  return {
    ...base,
    template: base.template ?? getDefaultReplyTemplate(base.kind),
  };
}

export const DEFAULT_REPLY_COMMANDS: TelegramReplyCommand[] = [
  commandWithDefaultTemplate({
    id: "help",
    label: "Trợ giúp",
    enabled: true,
    commands: ["/start", "/help"],
    keywords: [],
    kind: "help",
  }),
  commandWithDefaultTemplate({
    id: "market",
    label: "Giá thị trường",
    enabled: true,
    commands: ["/market", "/gia", "/giavang"],
    keywords: ["vàng", "gold", "bạc", "bac", "usd", "tỷ giá", "ty gia"],
    kind: "market",
  }),
  commandWithDefaultTemplate({
    id: "digest",
    label: "Bản tin tóm tắt",
    enabled: true,
    commands: ["/digest"],
    keywords: [],
    kind: "digest",
  }),
  commandWithDefaultTemplate({
    id: "news",
    label: "Tin RSS",
    enabled: true,
    commands: ["/tin", "/news", "/tintuc"],
    keywords: ["tin", "news"],
    kind: "news",
  }),
];

export function formatHelpList(commands: TelegramReplyCommand[]): string {
  const enabled = commands.filter((c) => c.enabled);
  if (!enabled.length) return "<i>Chưa có lệnh nào đang bật.</i>";
  return enabled
    .map((c) => {
      const triggers = [...c.commands, ...c.keywords].join(", ") || c.label;
      return `• <b>${c.label}</b> — ${triggers}`;
    })
    .join("\n");
}

export function formatNewsList(items: NewsItem[]): string {
  if (!items.length) return "<i>Chưa lấy được tin tức.</i>";
  return items
    .slice(0, 5)
    .map(
      (item) =>
        `• <a href="${item.link}">${item.title}</a>\n  <i>${item.source} · ${item.category}</i>`,
    )
    .join("\n\n");
}

/** Bổ sung template mặc định nếu file cũ chưa có — không ghi đè template user đã sửa. */
export function hydrateReplyCommands(commands: TelegramReplyCommand[]): TelegramReplyCommand[] {
  const defaultsById = Object.fromEntries(DEFAULT_REPLY_COMMANDS.map((c) => [c.id, c]));
  return commands.map((cmd) => ({
    ...defaultsById[cmd.id],
    ...cmd,
    template: cmd.template?.trim() ? cmd.template : getDefaultReplyTemplate(cmd.kind),
  }));
}

function ensureDataDir(): void {
  const dir = path.dirname(REPLIES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readTelegramRepliesFile(): TelegramRepliesFile {
  try {
    if (!existsSync(REPLIES_PATH)) {
      return { commands: structuredClone(DEFAULT_REPLY_COMMANDS) };
    }
    const parsed = JSON.parse(readFileSync(REPLIES_PATH, "utf-8")) as TelegramRepliesFile;
    if (!parsed.commands?.length) {
      return { commands: structuredClone(DEFAULT_REPLY_COMMANDS) };
    }
    return {
      ...parsed,
      commands: hydrateReplyCommands(parsed.commands),
      savedTemplates: parsed.savedTemplates ?? [],
    };
  } catch {
    return { commands: structuredClone(DEFAULT_REPLY_COMMANDS) };
  }
}

export function writeTelegramRepliesFile(data: TelegramRepliesFile): void {
  ensureDataDir();
  writeFileSync(
    REPLIES_PATH,
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

export function getTelegramReplyCommands(): TelegramReplyCommand[] {
  return readTelegramRepliesFile().commands;
}

export function saveTelegramReplyCommands(commands: TelegramReplyCommand[], extras?: Partial<TelegramRepliesFile>): void {
  const current = readTelegramRepliesFile();
  writeTelegramRepliesFile({
    ...current,
    ...extras,
    commands,
  });
}

export function saveNamedTemplate(
  name: string,
  snapshot: {
    commands: TelegramReplyCommand[];
    defaultDisabledReply?: string;
    unknownReply?: string;
  },
): SavedMessageTemplate {
  const file = readTelegramRepliesFile();
  const id = `tpl-${Date.now()}`;
  const t: SavedMessageTemplate = {
    id,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    commands: structuredClone(snapshot.commands),
    defaultDisabledReply: snapshot.defaultDisabledReply,
    unknownReply: snapshot.unknownReply,
  };
  writeTelegramRepliesFile({
    ...file,
    savedTemplates: [...(file.savedTemplates ?? []), t],
  });
  return t;
}

export function deleteNamedTemplate(templateId: string): boolean {
  const file = readTelegramRepliesFile();
  const before = file.savedTemplates ?? [];
  const after = before.filter((x) => x.id !== templateId);
  if (after.length === before.length) return false;
  writeTelegramRepliesFile({ ...file, savedTemplates: after });
  return true;
}

export function applyNamedTemplate(templateId: string): boolean {
  const file = readTelegramRepliesFile();
  const t = file.savedTemplates?.find((x) => x.id === templateId);
  if (!t) return false;
  writeTelegramRepliesFile({
    ...file,
    commands: hydrateReplyCommands(structuredClone(t.commands)),
    ...(t.defaultDisabledReply !== undefined ? { defaultDisabledReply: t.defaultDisabledReply } : {}),
    ...(t.unknownReply !== undefined ? { unknownReply: t.unknownReply } : {}),
  });
  return true;
}

export function resetTelegramReplyCommands(): TelegramRepliesFile {
  const prev = readTelegramRepliesFile();
  const fresh: TelegramRepliesFile = {
    commands: structuredClone(DEFAULT_REPLY_COMMANDS),
    defaultDisabledReply: DEFAULT_DISABLED,
    unknownReply: DEFAULT_UNKNOWN,
    savedTemplates: prev.savedTemplates ?? [],
  };
  writeTelegramRepliesFile(fresh);
  return fresh;
}

function normalizeTrigger(s: string): string {
  return s.trim().toLowerCase();
}

export function matchIncomingText(
  text: string,
  commands: TelegramReplyCommand[] = getTelegramReplyCommands(),
): MatchResult | null {
  const normalized = text.trim().toLowerCase();
  const firstWord = normalized.split(/\s+/)[0] ?? "";

  for (const command of commands) {
    for (const cmd of command.commands) {
      const t = normalizeTrigger(cmd);
      if (t && firstWord === t) {
        return { command, matchedBy: "command", matchedValue: t };
      }
    }
    for (const kw of command.keywords) {
      const k = normalizeTrigger(kw);
      if (k && normalized.includes(k)) {
        return { command, matchedBy: "keyword", matchedValue: k };
      }
    }
  }
  return null;
}

async function buildTemplateContext(
  match?: MatchResult,
  allCommands: TelegramReplyCommand[] = getTelegramReplyCommands(),
): Promise<Record<string, string>> {
  const [metals, forex, newsHeadline, newsList] = await Promise.all([
    fetchMetalSpots(),
    fetchForex(),
    fetchNewsFromFeeds(undefined, 1),
    fetchNewsFromFeeds(undefined, 5),
  ]);
  const gold = metals.find((m) => m.key === "gold");
  const silver = metals.find((m) => m.key === "silver");
  const vnd = vndPerUsd(forex);
  const eur = forex.rates.find((r) => r.code === "EUR");
  const goldVnd =
    gold?.priceUsd != null && vnd ? (gold.priceUsd * vnd).toLocaleString("vi-VN") : "—";

  const base: Record<string, string> = {
    "{{gold}}": gold?.priceUsd != null ? gold.priceUsd.toFixed(2) : "—",
    "{{silver}}": silver?.priceUsd != null ? silver.priceUsd.toFixed(2) : "—",
    "{{usdVnd}}": vnd ? vnd.toLocaleString("vi-VN") : "—",
    "{{goldVnd}}": goldVnd,
    "{{eurUsd}}": eur ? eur.rate.toFixed(4) : "—",
    "{{updatedAt}}": new Date().toLocaleString("vi-VN"),
    "{{command}}": match?.matchedValue ?? "",
    "{{label}}": match?.command.label ?? "",
    "{{headline}}": newsHeadline[0]?.title ?? "—",
    "{{newsList}}": formatNewsList(newsList),
    "{{helpList}}": formatHelpList(allCommands),
    "{{body}}": "",
  };

  const registry = await buildRegistryTemplateVars();
  const dataSources = await buildDataSourceTemplateVars();
  return { ...base, ...registry, ...dataSources };
}

function applyTemplate(template: string, vars: Record<string, string>, body = ""): string {
  let out = template;
  const all = { ...vars, "{{body}}": body };
  for (const [key, val] of Object.entries(all)) {
    out = out.split(key).join(val);
  }
  return out;
}

async function buildBuiltinBody(kind: ReplyBuiltinKind, commands: TelegramReplyCommand[]): Promise<string> {
  switch (kind) {
    case "help":
      return buildHelpTextFromCommands(commands.filter((c) => c.enabled));
    case "market":
      return buildDetailedMarketText();
    case "digest":
      return buildMarketDigestText();
    case "news":
      return buildNewsSnippetText();
    default:
      return "";
  }
}

export async function resolveReplyForCommand(
  command: TelegramReplyCommand,
  match?: MatchResult,
  allCommands: TelegramReplyCommand[] = getTelegramReplyCommands(),
): Promise<string> {
  const vars = await buildTemplateContext(match, allCommands);
  const body = await buildBuiltinBody(command.kind, allCommands);
  vars["{{body}}"] = body;

  const tpl = command.template?.trim() || getDefaultReplyTemplate(command.kind);

  if (!command.template?.trim() && (command.prefixTemplate?.trim() || command.suffixTemplate?.trim())) {
    const parts: string[] = [];
    if (command.prefixTemplate?.trim()) {
      parts.push(applyTemplate(command.prefixTemplate.trim(), vars, body));
    } else {
      parts.push(applyTemplate(tpl, vars, body));
    }
    if (command.suffixTemplate?.trim()) {
      parts.push(applyTemplate(command.suffixTemplate.trim(), vars, body));
    }
    return parts.join("\n\n");
  }

  return applyTemplate(tpl, vars, body);
}

export function resolveDisabledReply(
  command: TelegramReplyCommand,
  match: MatchResult,
  config: TelegramRepliesFile = readTelegramRepliesFile(),
): string {
  const tpl =
    command.disabledReply?.trim() ||
    config.defaultDisabledReply?.trim() ||
    DEFAULT_DISABLED;
  return applyTemplate(tpl, {
    "{{command}}": match.matchedValue,
    "{{label}}": command.label,
    "{{updatedAt}}": new Date().toLocaleString("vi-VN"),
  });
}

export async function handleInboundTelegramText(text: string): Promise<string> {
  const config = readTelegramRepliesFile();
  const match = matchIncomingText(text, config.commands);

  if (!match) {
    const unknown = config.unknownReply?.trim() || DEFAULT_UNKNOWN;
    return unknown;
  }

  if (!match.command.enabled) {
    return resolveDisabledReply(match.command, match, config);
  }

  return resolveReplyForCommand(match.command, match, config.commands);
}

export async function previewReplyCommand(commandId: string): Promise<{ text: string; command?: TelegramReplyCommand }> {
  const config = readTelegramRepliesFile();
  const command = config.commands.find((c) => c.id === commandId);
  if (!command) {
    throw new Error("Không tìm thấy lệnh");
  }
  const sampleTrigger = command.commands[0] ?? command.keywords[0] ?? command.label;
  const match: MatchResult = {
    command,
    matchedBy: command.commands.length ? "command" : "keyword",
    matchedValue: sampleTrigger,
  };
  const text = command.enabled
    ? await resolveReplyForCommand(command, match, config.commands)
    : resolveDisabledReply(command, match, config);
  return { text, command };
}
