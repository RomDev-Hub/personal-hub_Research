"use client";

import { X } from "lucide-react";
import { ALERT_ASSET_LABELS } from "@/lib/alert-constants";
import { formatNumber, formatUsd } from "@/lib/format";
import type { TriggeredAlert } from "@/lib/types";

interface AlertToastsProps {
  items: TriggeredAlert[];
  onDismiss: (id: string) => void;
}

function formatValue(alert: TriggeredAlert): string {
  if (alert.asset === "usdVnd") return formatNumber(alert.currentValue);
  return formatUsd(alert.currentValue);
}

export function AlertToasts({ items, onDismiss }: AlertToastsProps) {
  if (items.length === 0) return null;

  return (
    <div className="alert-toast-stack" role="alert" aria-live="polite">
      {items.map((t) => (
        <div key={`${t.alertId}-${t.at}`} className="alert-toast">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
              Cảnh báo giá
            </p>
            <p className="mt-1 text-sm font-medium">{ALERT_ASSET_LABELS[t.asset]}</p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {t.side === "upper" ? "Vượt ngưỡng trên" : "Xuống dưới ngưỡng dưới"} · hiện tại{" "}
              <span className="font-mono text-[var(--foreground)]">{formatValue(t)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(`${t.alertId}-${t.at}`)}
            className="shrink-0 rounded-lg p-1 text-[var(--muted)] hover:bg-white/10"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
