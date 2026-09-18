import { getDueSchedules, markScheduleRan } from "./schedule";
import {
  buildDetailedMarketText,
  buildMarketDigestText,
} from "./telegram-content";
import { getTelegramConfig, sendTelegramMessage } from "./telegram";
import type { ScheduleJob } from "./types";

export async function runScheduleJob(
  job: ScheduleJob,
  options?: { skipMark?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const { chatId } = getTelegramConfig();
  if (!chatId) {
    return { ok: false, error: "Chưa cấu hình TELEGRAM_CHAT_ID" };
  }

  let text: string;
  switch (job.action) {
    case "digest":
      text = await buildMarketDigestText();
      break;
    case "market":
      text = await buildDetailedMarketText();
      break;
    case "custom":
      text = job.customMessage?.trim() || "📌 Nhắc từ Personal Hub";
      break;
    default:
      return { ok: false, error: "action không hợp lệ" };
  }

  const prefix = job.name ? `<b>⏰ ${job.name}</b>\n\n` : "";
  const result = await sendTelegramMessage(prefix + text);
  if (result.ok && !options?.skipMark) {
    await markScheduleRan(job.id);
  }
  return result;
}

export async function runDueSchedules(): Promise<
  Array<{ jobId: string; name: string; ok: boolean; error?: string }>
> {
  const due = await getDueSchedules();
  const results: Array<{ jobId: string; name: string; ok: boolean; error?: string }> = [];

  for (const job of due) {
    const r = await runScheduleJob(job);
    results.push({ jobId: job.id, name: job.name, ok: r.ok, error: r.error });
  }

  return results;
}
