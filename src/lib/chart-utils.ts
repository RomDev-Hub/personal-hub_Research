import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { ChartRange, HistoryPoint } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getRangeBounds(range: ChartRange): { start: number; end: number } {
  const end = Date.now();
  const ms: Record<ChartRange, number> = {
    "24h": DAY_MS,
    "7d": 7 * DAY_MS,
    "30d": 30 * DAY_MS,
    "1y": 365 * DAY_MS,
    "5y": 5 * 365 * DAY_MS,
  };
  return { start: end - ms[range], end };
}

export function filterHistoryByRange(history: HistoryPoint[], range: ChartRange): HistoryPoint[] {
  if (history.length === 0) return history;
  const { start } = getRangeBounds(range);
  return history.filter((p) => new Date(p.timestamp).getTime() >= start);
}

/** 24h giữ chi tiết phút; khoảng dài gộp 1 điểm/ngày để tránh méo trục (intraday + daily). */
export function aggregateForChartRange(history: HistoryPoint[], range: ChartRange): HistoryPoint[] {
  const filtered = filterHistoryByRange(history, range);
  if (range === "24h" || filtered.length === 0) return filtered;

  const byDay = new Map<string, HistoryPoint>();
  for (const p of filtered) {
    const day = p.timestamp.slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || new Date(p.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
      byDay.set(day, p);
    }
  }
  return [...byDay.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function prepareChartHistory(history: HistoryPoint[], range: ChartRange, maxPoints = 800): HistoryPoint[] {
  return downsampleHistory(aggregateForChartRange(history, range), maxPoints);
}

/** Toàn bộ lịch sử gộp theo ngày (cho navigator / zoom tay); không cắt theo preset toolbar. */
export function prepareFullChartHistory(history: HistoryPoint[], maxPoints = 1500): HistoryPoint[] {
  if (history.length === 0) return [];
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const byDay = new Map<string, HistoryPoint>();
  for (const p of sorted) {
    const day = p.timestamp.slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || new Date(p.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
      byDay.set(day, p);
    }
  }
  const daily = [...byDay.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return downsampleHistory(daily, maxPoints);
}

export function downsampleHistory(points: HistoryPoint[], maxPoints = 800): HistoryPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

export function mergeHistory(local: HistoryPoint[], external: HistoryPoint[]): HistoryPoint[] {
  const localDays = new Set(local.map((p) => p.timestamp.slice(0, 10)));
  const externalOnly = external.filter((p) => !localDays.has(p.timestamp.slice(0, 10)));
  return [...externalOnly, ...local].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function historyDaysForRange(range: ChartRange): number {
  if (range === "24h") return 2;
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "1y") return 365;
  return 365 * 5;
}

export function formatChartAxisTick(iso: string, range: ChartRange): string {
  const d = new Date(iso);
  if (range === "24h") {
    return format(d, "HH:mm", { locale: vi });
  }
  if (range === "7d") {
    return format(d, "dd/MM", { locale: vi });
  }
  if (range === "30d" || range === "1y") {
    return format(d, "dd/MM/yy", { locale: vi });
  }
  return format(d, "MM/yyyy", { locale: vi });
}

export function formatChartTooltipTime(iso: string): string {
  return format(new Date(iso), "EEEE, dd/MM/yyyy · HH:mm", { locale: vi });
}

export function formatRangeLabel(range: ChartRange, points: HistoryPoint[]): string {
  if (!points.length) return "Chưa có dữ liệu trong khoảng này";
  const first = new Date(points[0].timestamp);
  const last = new Date(points[points.length - 1].timestamp);
  const fmt = (d: Date) =>
    format(d, range === "24h" ? "dd/MM HH:mm" : "dd/MM/yyyy", { locale: vi });
  return `${points.length} điểm · ${fmt(first)} → ${fmt(last)}`;
}

export function chartCoverageNote(range: ChartRange, points: HistoryPoint[]): string | null {
  if ((range !== "1y" && range !== "5y") || points.length < 2) return null;
  const first = new Date(points[0].timestamp);
  const spanYears = (Date.now() - first.getTime()) / (365 * DAY_MS);
  const wantYears = range === "5y" ? 5 : 1;
  if (spanYears < wantYears * 0.85) {
    return `Lưu ý: dữ liệu giavang.now bắt đầu từ ${format(first, "dd/MM/yyyy", { locale: vi })} — chưa phủ đủ ${wantYears} năm.`;
  }
  return null;
}

export function niceYDomain(values: number[], paddingPct = 0.08): [number, number] {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return [0, 1];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (min === max) {
    const pad = Math.abs(min) * 0.02 || 1;
    return [min - pad, max + pad];
  }
  const span = max - min;
  const pad = span * paddingPct;
  return [min - pad, max + pad];
}

export function formatYAxisTick(value: number, kind: "usd" | "vnd" | "rate"): string {
  if (kind === "vnd") {
    if (value >= 100) return `${value.toFixed(0)}`;
    return value.toFixed(1);
  }
  if (kind === "usd") {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}
