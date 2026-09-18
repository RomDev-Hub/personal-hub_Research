import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Trạng thái cấu hình (không lộ secret). */
export async function GET() {
  const hasTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const hasChat = Boolean(process.env.TELEGRAM_CHAT_ID?.trim());
  const hasCronSecret = Boolean(process.env.HUB_CRON_SECRET?.trim());
  const marketPollMs = Number(process.env.NEXT_PUBLIC_MARKET_POLL_MS ?? 30_000);
  const clientTickMs = Number(process.env.NEXT_PUBLIC_HUB_CLIENT_TICK_MS ?? 0);
  const uiRefreshMs = Number(process.env.NEXT_PUBLIC_TELEGRAM_UI_REFRESH_MS ?? 60_000);

  return NextResponse.json({
    ok: true,
    runtime: "local",
    telegram: {
      tokenConfigured: hasTelegram,
      chatConfigured: hasChat,
      ready: hasTelegram && hasChat,
    },
    intervals: {
      marketPollMs: Number.isFinite(marketPollMs) ? marketPollMs : 30_000,
      hubClientTickMs: Number.isFinite(clientTickMs) ? clientTickMs : 0,
      telegramUiRefreshMs: Number.isFinite(uiRefreshMs) ? uiRefreshMs : 60_000,
    },
    security: {
      hubTickSecret: hasCronSecret,
    },
    dataSources: [
      { id: "metals.live", label: "Vàng/bạc quốc tế (metals.live)", env: null },
      { id: "frankfurter", label: "USD/VND (Frankfurter)", env: null },
      { id: "giavang", label: "Vàng VN (giavang.now)", env: null },
      { id: "rss", label: "Tin RSS (VnExpress, Tuổi Trẻ, …)", env: null },
      { id: "github", label: "GitHub Trending API", env: null },
    ],
    note: "Worker ./scripts/start.sh vẫn chạy lịch Telegram khi terminal mở — tắt terminal hoặc HUB_NO_WORKER=1 để dừng hẳn.",
  });
}
