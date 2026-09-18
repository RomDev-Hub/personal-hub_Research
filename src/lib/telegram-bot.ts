import { promises as fs } from "fs";
import path from "path";
import { handleInboundTelegramText } from "./telegram-replies";
import { getTelegramConfig, sendTelegramToChat } from "./telegram";

const TELEGRAM_API = "https://api.telegram.org";
const STATE_FILE = path.join(process.cwd(), "data", "telegram-state.json");

interface TelegramState {
  lastUpdateId: number;
  autoReplyEnabled: boolean;
}

async function readState(): Promise<TelegramState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw) as TelegramState;
  } catch {
    return { lastUpdateId: 0, autoReplyEnabled: true };
  }
}

async function writeState(state: TelegramState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export async function getBotSettings(): Promise<TelegramState> {
  return readState();
}

export async function setAutoReply(enabled: boolean): Promise<void> {
  const state = await readState();
  state.autoReplyEnabled = enabled;
  await writeState(state);
}

function isAllowedChat(chatId: number | string): boolean {
  const configured = getTelegramConfig().chatId;
  if (!configured) return true;
  return String(chatId) === String(configured);
}

async function reply(chatId: number | string, text: string): Promise<void> {
  await sendTelegramToChat(chatId, text);
}

async function handleText(chatId: number, text: string): Promise<void> {
  const replyText = await handleInboundTelegramText(text);
  await reply(chatId, replyText);
}

export interface PollResult {
  processed: number;
  replied: number;
  autoReplyEnabled: boolean;
}

export async function pollAndReplyTelegram(): Promise<PollResult> {
  const { token } = getTelegramConfig();
  const state = await readState();

  if (!token) {
    return { processed: 0, replied: 0, autoReplyEnabled: state.autoReplyEnabled };
  }

  if (!state.autoReplyEnabled) {
    return { processed: 0, replied: 0, autoReplyEnabled: false };
  }

  const offset = state.lastUpdateId + 1;
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates?offset=${offset}&timeout=0&limit=30`, {
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json()) as {
    ok: boolean;
    result?: Array<{
      update_id: number;
      message?: {
        message_id: number;
        chat: { id: number };
        text?: string;
        date: number;
        from?: { first_name?: string; username?: string };
      };
    }>;
  };

  if (!data.ok || !data.result?.length) {
    return { processed: 0, replied: 0, autoReplyEnabled: state.autoReplyEnabled };
  }

  let replied = 0;

  for (const update of data.result) {
    state.lastUpdateId = Math.max(state.lastUpdateId, update.update_id);

    const msg = update.message;
    if (!msg?.text || !msg.chat?.id) continue;
    if (!isAllowedChat(msg.chat.id)) continue;

    try {
      await handleText(msg.chat.id, msg.text);
      replied += 1;
    } catch (e) {
      console.error("[telegram-bot] reply error:", e);
    }
  }

  await writeState(state);
  return {
    processed: data.result.length,
    replied,
    autoReplyEnabled: state.autoReplyEnabled,
  };
}

export async function getRecentInboundMessages(limit = 20): Promise<
  Array<{ id: number; text: string; date: string; from?: string; chatId: number }>
> {
  const { token } = getTelegramConfig();
  if (!token) return [];

  const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates?limit=${limit}`, {
    signal: AbortSignal.timeout(10000),
  });

  const data = (await res.json()) as {
    ok: boolean;
    result?: Array<{
      message?: {
        message_id: number;
        chat: { id: number };
        text?: string;
        date: number;
        from?: { username?: string; first_name?: string };
      };
    }>;
  };

  if (!data.ok || !data.result) return [];

  return data.result
    .filter((u) => u.message?.text)
    .map((u) => ({
      id: u.message!.message_id,
      chatId: u.message!.chat.id,
      text: u.message!.text!,
      date: new Date(u.message!.date * 1000).toISOString(),
      from: u.message!.from?.username ?? u.message!.from?.first_name,
    }))
    .reverse();
}
