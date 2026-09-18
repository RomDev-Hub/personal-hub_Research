"use client";

import { Activity, AlertCircle, RefreshCw } from "lucide-react";

interface MarketStatusProps {
  source: string;
  lastUpdated?: string;
  refreshing: boolean;
  error: string | null;
  pollMs: number;
}

export function MarketStatus({
  source,
  lastUpdated,
  refreshing,
  error,
  pollMs,
}: MarketStatusProps) {
  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <div className="market-status">
      <div className="market-status-item">
        <span className="market-status-label">Nguồn</span>
        <span className="market-status-value">{source}</span>
      </div>

      <div className="market-status-item">
        <span className="market-status-label">Cập nhật</span>
        <span className="market-status-value font-mono tabular-nums">{updatedLabel}</span>
      </div>

      <div className="market-status-item">
        {error ? (
          <span className="market-status-dot market-status-error">
            <AlertCircle className="h-3.5 w-3.5" />
            Lỗi
          </span>
        ) : refreshing ? (
          <span className="market-status-dot market-status-loading">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Đang làm mới…
          </span>
        ) : (
          <span className="market-status-dot market-status-live">
            <Activity className="h-3.5 w-3.5" />
            Live · {Math.round(pollMs / 1000)}s
          </span>
        )}
      </div>
    </div>
  );
}
