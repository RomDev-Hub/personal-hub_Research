"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { loadHubUiSettings, patchHubUiSettings } from "@/lib/hub-settings";
import { SettingsKvCard } from "./SettingsKvCard";
import { SettingsPageShell } from "./SettingsPageShell";

interface HubStatus {
  intervals: { marketPollMs: number; hubClientTickMs: number; telegramUiRefreshMs: number };
  telegram: { ready: boolean; tokenConfigured: boolean; chatConfigured: boolean };
  note: string;
}

interface SettingsSystemPanelProps {
  onBack: () => void;
}

export function SettingsSystemPanel({ onBack }: SettingsSystemPanelProps) {
  const [pauseHidden, setPauseHidden] = useState(
    () => loadHubUiSettings().pauseBrowserWorkWhenHidden,
  );
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hub/status", { cache: "no-store" });
      setStatus((await res.json()) as HubStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/hub/status", { cache: "no-store" });
        const json = (await res.json()) as HubStatus;
        if (!cancelled) setStatus(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function togglePause() {
    const next = !pauseHidden;
    setPauseHidden(next);
    patchHubUiSettings({ pauseBrowserWorkWhenHidden: next });
  }

  const pollSec = status ? Math.round(status.intervals.marketPollMs / 1000) : 30;

  return (
    <SettingsPageShell
      title="HỆ THỐNG"
      titleAccent="& NỀN"
      subtitle="Chạy local — worker trong terminal; trình duyệt chỉ poll khi tab đang mở (có thể tạm dừt)."
      onBack={onBack}
    >
      <SettingsKvCard
        title="TÀI KHOẢN"
        titleAccent="& DỮ LIỆU"
        rows={[
          {
            label: "Chế độ",
            value: "Local (127.0.0.1)",
          },
          {
            label: "Tần suất thị trường",
            value: loading ? "…" : `${pollSec} giây / lần`,
          },
          {
            label: "Worker lịch Telegram",
            value: "scripts/start.sh (45s/tick)",
          },
          {
            label: "Telegram .env",
            value: loading
              ? "…"
              : status?.telegram.ready
                ? "Đã cấu hình"
                : "Chưa đủ token/chat",
            valueClassName: status?.telegram.ready ? "text-emerald-400" : "text-amber-400",
          },
        ]}
        footer={
          <p className="text-xs text-[var(--muted)]">
            {status?.note ??
              "Đóng terminal chạy start.sh = dừng lịch & bot. Tab trình duyệt đóng = không poll UI."}
          </p>
        }
      />

      <section className="settings-kv-card p-5">
        <h3 className="text-sm font-semibold">Khi không dùng tab</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Không bắt buộc &quot;tắt app&quot;. Bật tùy chọn dưới để ngừng poll thị trường và refresh Telegram trên
          trình duyệt khi tab ẩn — tiết kiệm tài nguyên. Worker trong terminal vẫn chạy nếu bạn chưa đóng{" "}
          <code className="text-[var(--accent)]">start.sh</code>.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={pauseHidden} onChange={togglePause} className="h-4 w-4" />
          <span>Tạm dừt poll trình duyệt khi tab không hiển thị</span>
        </label>
        <button
          type="button"
          onClick={loadStatus}
          className="btn-secondary mt-4 flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới trạng thái
        </button>
      </section>

      <p className="text-xs text-[var(--muted)]">
        Token Telegram, secret API và thử endpoint nằm ở <strong>API dữ liệu</strong> / <strong>Telegram</strong> — không
        hiển thị ở đây để tránh trùng.
      </p>
    </SettingsPageShell>
  );
}
