"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronRight, Inbox, MessageSquare, XCircle } from "lucide-react";
import { Card } from "./Card";
import { SchedulePanel } from "./SchedulePanel";
import { TelegramInboundRepliesPanel } from "./TelegramInboundRepliesPanel";
import type { TelegramStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useHubBrowserPause } from "@/lib/use-hub-browser-pause";
import { SettingsAdvancedLab } from "./settings/SettingsAdvancedLab";

interface TelegramUpdate {
  id: number;
  text: string;
  date: string;
  from?: string;
  chatId: number;
}

const ENV_CLIENT_TICK_MS_RAW = Number(process.env.NEXT_PUBLIC_HUB_CLIENT_TICK_MS ?? "0");
const ENV_CLIENT_TICK_MS_ACTIVE =
  Number.isFinite(ENV_CLIENT_TICK_MS_RAW) && ENV_CLIENT_TICK_MS_RAW > 0
    ? ENV_CLIENT_TICK_MS_RAW
    : 0;

interface TelegramPanelProps {
  /** Ẩn tiêu đề khi nằm trong Cài đặt → Telegram. */
  embedded?: boolean;
  /** Lab API nâng cao (mặc định true khi không embedded). */
  showAdvanced?: boolean;
}

export function TelegramPanel({ embedded = false, showAdvanced = true }: TelegramPanelProps) {
  const browserPaused = useHubBrowserPause();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [updates, setUpdates] = useState<TelegramUpdate[]>([]);
  const [hasChatId, setHasChatId] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pollInfo, setPollInfo] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram");
      const json = (await res.json()) as {
        status: TelegramStatus;
        updates: TelegramUpdate[];
        hasChatId: boolean;
        autoReplyEnabled: boolean;
      };
      setStatus(json.status);
      setUpdates(json.updates ?? []);
      setHasChatId(json.hasChatId);
      setAutoReply(json.autoReplyEnabled ?? true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (browserPaused) return;

    const uiMsRaw = Number(process.env.NEXT_PUBLIC_TELEGRAM_UI_REFRESH_MS);
    const clientTickMsRaw = Number(process.env.NEXT_PUBLIC_HUB_CLIENT_TICK_MS);
    const refreshMs =
      Number.isFinite(uiMsRaw) && uiMsRaw >= 5_000 ? uiMsRaw : 60_000;
    const clientTickMs =
      Number.isFinite(clientTickMsRaw) && clientTickMsRaw > 0 ? clientTickMsRaw : 0;

    const refreshId = setInterval(() => {
      load();
    }, refreshMs);

    let tickId: ReturnType<typeof setInterval> | undefined;
    if (clientTickMs > 0) {
      const tick = async () => {
        try {
          await fetch("/api/hub/tick", { method: "POST" });
          const poll = await fetch("/api/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll" }),
          });
          const json = (await poll.json()) as { replied?: number };
          if (json.replied) {
            setPollInfo(`Bot vừa trả lời ${json.replied} tin`);
            await load();
          }
        } catch {
          /* ignore when server starting */
        }
      };
      tick();
      tickId = setInterval(tick, clientTickMs);
    }

    return () => {
      clearInterval(refreshId);
      if (tickId) clearInterval(tickId);
    };
  }, [load, browserPaused]);

  async function postAction(action: string, extra?: Record<string, unknown>) {
    setSending(true);
    setTestFeedback(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; replied?: number };
      setTestFeedback({
        ok: json.ok,
        text: json.ok
          ? action === "poll"
            ? `Đã xử lý ${json.replied ?? 0} tin trả lời`
            : "Kết nối Telegram OK."
          : (json.error ?? "Thất bại"),
      });
      await load();
    } finally {
      setSending(false);
    }
  }

  async function toggleAutoReply() {
    const next = !autoReply;
    await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_auto_reply", enabled: next }),
    });
    setAutoReply(next);
  }

  const wrapperClass = embedded ? "space-y-5" : "mx-auto max-w-3xl space-y-5";

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <div>
          <h2 className="text-xl font-bold">Telegram</h2>
          <p className="text-sm text-[var(--muted)]">
            Lịch gửi tự động, phản hồi lệnh từ Telegram, hộp thư đến
          </p>
        </div>
      )}

      {browserPaused && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-2 text-xs text-[var(--muted)]">
          Poll trình duyệt đang tạm dừng (tab ẩn). Cài đặt → Hệ thống & nền để đổi.
        </p>
      )}

      <Card
        title="Trạng thái & kết nối"
        action={
          <button
            type="button"
            disabled={sending}
            onClick={() => postAction("test")}
            className="btn-primary text-xs"
          >
            Test kết nối
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Đang kiểm tra...</p>
        ) : status?.configured ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p>
                  Bot: <strong>@{status.botUsername}</strong>
                </p>
                <p className="mt-1 font-mono text-xs">
                  Chat ID: {hasChatId ? status.chatId : "Chưa cấu hình"}
                </p>
                {status.chatIdError && (
                  <p className="mt-2 text-xs text-red-300">{status.chatIdError}</p>
                )}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={autoReply} onChange={toggleAutoReply} />
              <Bot className="h-4 w-4 text-[var(--accent)]" />
              <span>
                Bot trả lời khi bạn nhắn lệnh trên Telegram (/market, /tin, …) — cấu hình chi tiết ở{" "}
                <em>Tin nhắn chủ động</em>
              </span>
            </label>
            <p className="text-xs text-[var(--muted)]">
              {ENV_CLIENT_TICK_MS_ACTIVE > 0
                ? `Trình duyệt đang gọi tick + poll mỗi ${ENV_CLIENT_TICK_MS_ACTIVE / 1000}s (chỉ dùng khi không có hub-worker).`
                : "Lịch và quét tin trả lời do hub-worker (/scripts/start.sh); tab chỉ làm mới trạng thái định kỳ."}
            </p>
            {pollInfo && <p className="text-xs text-emerald-400">{pollInfo}</p>}
            {testFeedback && (
              <p className={`text-xs ${testFeedback.ok ? "text-emerald-400" : "text-red-300"}`}>
                {testFeedback.text}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm">
            <XCircle className="h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-red-300">{status?.lastError ?? "Chưa cấu hình"}</p>
              <SetupGuide />
            </div>
          </div>
        )}
      </Card>

      <SchedulePanel />

      <TelegramInboundRepliesPanel />


      <section className="settings-kv-card">
        <button
          type="button"
          onClick={() => setInboxOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="truncate">
              Hộp thư đến
              {updates.length > 0 && (
                <span className="ml-1.5 font-normal text-[var(--muted)]">({updates.length})</span>
              )}
            </span>
          </span>
          {inboxOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        </button>

        {inboxOpen && (
          <div className="space-y-2 border-t border-[var(--border)] px-5 pb-4 pt-3">
            <p className="text-xs text-[var(--muted)]">
              Tin bạn gửi cho bot — dùng <code className="text-[var(--accent)]">/help</code> để xem lệnh.
            </p>
            {updates.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Chưa có tin — nhắn /start hoặc /market cho bot.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {updates.map((u) => (
                  <li key={u.id} className="rounded-md border border-[var(--border)]/60 bg-[var(--surface)]/50 px-2.5 py-2">
                    <p className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                      <MessageSquare className="h-3 w-3" />
                      {u.from ? `@${u.from}` : "Bạn"} · {formatDateTime(u.date)}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug">{u.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {showAdvanced && !embedded && <SettingsAdvancedLab />}
    </div>
  );
}

function SetupGuide() {
  return (
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-[var(--muted)]">
      <li>
        Telegram → <strong>@BotFather</strong> → <code>/newbot</code> → token
      </li>
      <li>
        Nhắn <code>/start</code> cho bot
      </li>
      <li>
        Lấy <code>message.chat.id</code> (số, vd <code>123456789</code>) từ getUpdates —{" "}
        <strong>không</strong> dùng @tên_bot
      </li>
      <li>
        Chạy <code>./scripts/start.sh</code> (kèm worker lịch + bot)
      </li>
    </ol>
  );
}
