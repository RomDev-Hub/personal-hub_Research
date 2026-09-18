import { NextResponse } from "next/server";
import { runScheduleJob } from "@/lib/schedule-runner";
import {
  buildDetailedMarketText,
  buildMarketDigestText,
  buildNewsSnippetText,
} from "@/lib/telegram-content";
import {
  getBotSettings,
  getRecentInboundMessages,
  pollAndReplyTelegram,
  setAutoReply,
} from "@/lib/telegram-bot";
import {
  getTelegramConfig,
  getTelegramStatus,
  sendTelegramMessage,
} from "@/lib/telegram";
import type { ScheduleJob } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [status, settings, updates] = await Promise.all([
    getTelegramStatus(),
    getBotSettings(),
    getRecentInboundMessages(25),
  ]);

  return NextResponse.json({
    status,
    updates,
    hasChatId: Boolean(getTelegramConfig().chatId),
    autoReplyEnabled: settings.autoReplyEnabled,
    lastUpdateId: settings.lastUpdateId,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: string;
    message?: string;
    enabled?: boolean;
    job?: ScheduleJob;
  };

  if (body.action === "test") {
    const result = await sendTelegramMessage(
      "✅ <b>Personal Hub</b> đã kết nối Telegram thành công!\n\n<i>Chạy local — không public host.</i>",
    );
    return NextResponse.json(result);
  }

  if (body.action === "digest") {
    const text = await buildMarketDigestText();
    return NextResponse.json(await sendTelegramMessage(text));
  }

  if (body.action === "market") {
    const text = await buildDetailedMarketText();
    return NextResponse.json(await sendTelegramMessage(text));
  }

  if (body.action === "news") {
    const text = await buildNewsSnippetText();
    return NextResponse.json(await sendTelegramMessage(text));
  }

  if (body.action === "send" && body.message?.trim()) {
    return NextResponse.json(await sendTelegramMessage(body.message.trim()));
  }

  if (body.action === "poll") {
    const result = await pollAndReplyTelegram();
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === "set_auto_reply" && typeof body.enabled === "boolean") {
    await setAutoReply(body.enabled);
    return NextResponse.json({ ok: true, autoReplyEnabled: body.enabled });
  }

  if (body.action === "run_schedule_now" && body.job) {
    const result = await runScheduleJob(body.job, { skipMark: true });
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: false, error: "action không hợp lệ" }, { status: 400 });
}
