/** Kiểm tra TELEGRAM_CHAT_ID trước khi gửi tin. */

export function humanizeTelegramSendError(description?: string): string {
  if (!description) return "Lỗi gửi Telegram";
  const d = description.toLowerCase();
  if (d.includes("bot can't send messages to the bot")) {
    return "Bot không gửi được cho chính nó — Chat ID phải là số chat của bạn (sau /start), không phải @tên_bot.";
  }
  if (d.includes("chat not found")) {
    return "Không tìm thấy chat — kiểm tra Chat ID hoặc nhắn /start cho bot trước.";
  }
  if (d.includes("bot was blocked")) {
    return "Bạn đã chặn bot — mở lại bot và nhắn /start.";
  }
  return description;
}

/** null = hợp lệ; string = lỗi hiển thị cho user. */
export function validateTelegramChatId(
  chatId: string,
  botUsername?: string,
): string | null {
  const t = chatId.trim();
  if (!t) return "Chat ID trống";

  if (t.startsWith("@")) {
    const uname = botUsername?.replace(/^@/, "").toLowerCase();
    const given = t.slice(1).toLowerCase();
    if (uname && given === uname) {
      return `Chat ID đang là @${botUsername} (chính bot). Cần số ID cá nhân của bạn từ getUpdates.`;
    }
    return "Chat ID không dùng @username. Cần số (vd 123456789) — xem getUpdates sau khi nhắn /start.";
  }

  if (!/^-?\d+$/.test(t)) {
    return "Chat ID phải là số (âm nếu là nhóm/supergroup).";
  }

  return null;
}
