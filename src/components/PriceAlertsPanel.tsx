"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Plus, Trash2 } from "lucide-react";
import { ALERT_ASSET_LABELS } from "@/lib/alert-constants";
import type { AlertAsset, PriceAlert } from "@/lib/types";
import { formatNumber, formatUsd, formatVnd } from "@/lib/format";
import { Card } from "./Card";

const ASSETS: AlertAsset[] = ["gold", "silver", "usdVnd", "sjcSell", "nhanSell"];

interface PriceAlertsPanelProps {
  currentPrices: Partial<Record<AlertAsset, number>>;
  onAlertsChange?: (alerts: PriceAlert[]) => void;
}

export function PriceAlertsPanel({ currentPrices, onAlertsChange }: PriceAlertsPanelProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [asset, setAsset] = useState<AlertAsset>("gold");
  const [upper, setUpper] = useState("");
  const [lower, setLower] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      const json = (await res.json()) as { alerts: PriceAlert[]; error?: string };
      if (json.error) throw new Error(json.error);
      setAlerts(json.alerts ?? []);
      onAlertsChange?.(json.alerts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được cảnh báo");
    } finally {
      setLoading(false);
    }
  }, [onAlertsChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveAlert() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        asset,
        upper: upper.trim() ? Number(upper) : null,
        lower: lower.trim() ? Number(lower) : null,
        enabled: true,
        notifyTelegram,
      };
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại");
      setUpper("");
      setLower("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu");
    } finally {
      setSaving(false);
    }
  }

  async function removeAlert(id: string) {
    await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  async function toggleAlert(alert: PriceAlert) {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...alert, enabled: !alert.enabled }),
    });
    await load();
  }

  function formatPrice(asset: AlertAsset, value?: number) {
    if (value == null) return "—";
    if (asset === "usdVnd") return formatNumber(value);
    if (asset === "sjcSell" || asset === "nhanSell") return formatVnd(value * 1_000_000);
    return formatUsd(value);
  }

  function thresholdPlaceholder(which: "upper" | "lower"): string {
    if (asset === "usdVnd") return which === "upper" ? "26500" : "25000";
    if (asset === "sjcSell") return which === "upper" ? "168" : "158";
    if (asset === "nhanSell") return which === "upper" ? "168" : "158";
    return which === "upper" ? "2500" : "2200";
  }

  return (
    <Card
      title="Cảnh báo giá"
      subtitle="Ngưỡng SJC/nhẫn nhập theo triệu VND/lượng (giống dữ liệu biểu đồ). Thông báo app + tùy chọn Telegram (cooldown 1 giờ/lần)"
    >
      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ASSETS.map((a) => (
          <div key={a} className="rounded-xl bg-[var(--surface)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">{ALERT_ASSET_LABELS[a]}</span>
            <p className="mt-0.5 font-mono font-semibold">{formatPrice(a, currentPrices[a])}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-xs text-[var(--muted)]">
          Tài sản
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as AlertAsset)}
            className="input mt-1 w-full"
          >
            {ASSETS.map((a) => (
              <option key={a} value={a}>
                {ALERT_ASSET_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Ngưỡng trên
          <input
            type="number"
            step="any"
            placeholder={thresholdPlaceholder("upper")}
            value={upper}
            onChange={(e) => setUpper(e.target.value)}
            className="input mt-1 w-full font-mono"
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Ngưỡng dưới
          <input
            type="number"
            step="any"
            placeholder={thresholdPlaceholder("lower")}
            value={lower}
            onChange={(e) => setLower(e.target.value)}
            className="input mt-1 w-full font-mono"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={notifyTelegram}
            onChange={(e) => setNotifyTelegram(e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          Gửi Telegram
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={saveAlert}
            disabled={saving}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Thêm cảnh báo
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-[var(--muted)]">Đang tải...</li>
        ) : alerts.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">Chưa có cảnh báo nào.</li>
        ) : (
          alerts.map((a) => (
            <li
              key={a.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                a.enabled ? "border-[var(--border)] bg-[var(--surface)]" : "border-dashed opacity-60"
              }`}
            >
              <div>
                <span className="font-medium">{ALERT_ASSET_LABELS[a.asset]}</span>
                <span className="ml-2 text-[var(--muted)]">
                  {a.upper != null && (
                    <span className="text-red-400">Trên {formatPrice(a.asset, a.upper)}</span>
                  )}
                  {a.upper != null && a.lower != null && " · "}
                  {a.lower != null && (
                    <span className="text-emerald-400">Dưới {formatPrice(a.asset, a.lower)}</span>
                  )}
                </span>
                {a.notifyTelegram && (
                  <span className="ml-2 rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-xs text-[var(--accent)]">
                    Telegram
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => toggleAlert(a)}
                  className="btn-secondary p-2"
                  title={a.enabled ? "Tắt" : "Bật"}
                >
                  {a.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => removeAlert(a.id)}
                  className="btn-secondary p-2 text-red-400"
                  title="Xóa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
