"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MarketChange } from "@/lib/market-changes";

export type StatAccent = "gold" | "silver" | "vnd" | "muted";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: StatAccent;
  change?: MarketChange;
  /** Hàm format diff theo đơn vị (vd: VND, USD). Nếu không truyền chỉ hiện %. */
  formatDiff?: (diff: number) => string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  sub,
  accent = "muted",
  change,
  formatDiff,
  loading,
}: StatCardProps) {
  const border =
    accent === "gold"
      ? "stat-card-gold"
      : accent === "silver"
        ? "stat-card-silver"
        : accent === "vnd"
          ? "stat-card-vnd"
          : "";

  if (loading) {
    return <div className={`stat-card skeleton min-h-[6.5rem] ${border}`} />;
  }

  return (
    <div className={`stat-card ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="stat-card-label">{label}</p>
        {change && <ChangeBadge change={change} formatDiff={formatDiff} />}
      </div>
      <p className="stat-card-value">{value}</p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </div>
  );
}

function ChangeBadge({
  change,
  formatDiff,
}: {
  change: MarketChange;
  formatDiff?: (diff: number) => string;
}) {
  const up = change.diff > 0;
  const down = change.diff < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const tone = up
    ? "stat-change-up"
    : down
      ? "stat-change-down"
      : "stat-change-flat";

  const pct = `${up ? "+" : ""}${change.pct.toFixed(2)}%`;
  const diff = formatDiff ? formatDiff(change.diff) : null;

  return (
    <span
      className={`stat-change ${tone}`}
      title={`So với ${new Date(change.comparedAt).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`}
    >
      <Icon className="h-3 w-3" />
      <span>{pct}</span>
      {diff && <span className="opacity-70">({diff})</span>}
    </span>
  );
}
