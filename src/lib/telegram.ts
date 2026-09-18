import type { TelegramStatus } from "./types";
import { getTelegramConfig } from "./hub-config";
import { humanizeTelegramSendError, validateTelegramChatId } from "./telegram-validate";

export { getTelegramConfig };

const TELEGRAM_API = "https://api.telegram.org";

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const { token, chatId } = getTelegramConfig();

  if (!token) {
    return { configured: false, lastError: "Chưa cấu hình TELEGRAM_BOT_TOKEN (.env.local hoặc Cài đặt)" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username?: string };
      description?: string;
    };

    if (!data.ok) {
      return { configured: false, lastError: data.description ?? "Token không hợp lệ" };
    }

    const botUsername = data.result?.username;
    const chatIdError = chatId ? validateTelegramChatId(chatId, botUsername) : null;

    return {
      configured: true,
      botUsername,
      chatId: chatId ?? undefined,
      chatIdError: chatIdError ?? undefined,
    };
  } catch (e) {
    return {
      configured: false,
      lastError: e instanceof Error ? e.message : "Lỗi kết nối Telegram",
    };
  }
}

export async function sendTelegramToChat(
  chatId: string | number,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const { token } = getTelegramConfig();
  if (!token) return { ok: false, error: "Chưa cấu hình token" };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return data.ok ? { ok: true } : { ok: false, error: humanizeTelegramSendError(data.description) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lỗi gửi" };
  }
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const { token, chatId } = getTelegramConfig();
  if (!chatId) {
    return { ok: false, error: "Chưa cấu hình TELEGRAM_CHAT_ID" };
  }
  let botUsername: string | undefined;
  if (token) {
    try {
      const me = await fetch(`${TELEGRAM_API}/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) });
      const j = (await me.json()) as { result?: { username?: string } };
      botUsername = j.result?.username;
    } catch {
      /* ignore */
    }
  }
  const chatErr = validateTelegramChatId(chatId, botUsername);
  if (chatErr) return { ok: false, error: chatErr };
  return sendTelegramToChat(chatId, text);
}

export async function getTelegramUpdates(): Promise<
  { id: number; text: string; date: string; from?: string; chatId: number }[]
> {
  const { token } = getTelegramConfig();
  if (!token) return [];

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates?limit=20`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        message?: {
          message_id: number;
          text?: string;
          date: number;
          chat: { id: number };
          from?: { username?: string };
        };
      }>;
    };
    if (!data.ok || !data.result) return [];

    return data.result
      .filter((u) => u.message?.text)
      .map((u) => ({
        id: u.message!.message_id,
        text: u.message!.text!,
        date: new Date(u.message!.date * 1000).toISOString(),
        from: u.message!.from?.username,
        chatId: u.message!.chat.id,
      }))
      .reverse();
  } catch {
    return [];
  }
}
