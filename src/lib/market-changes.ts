import type { HistoryPoint } from "./types";

export type MarketMetricKey =
  | "sjcSell"
  | "nhanSell"
  | "gold"
  | "silver"
  | "usdVnd"
  | "goldWorldVnd";

export interface MarketChange {
  value: number;
  prev: number;
  diff: number;
  pct: number;
  comparedAt: string;
}

export type MarketChanges = Partial<Record<MarketMetricKey, MarketChange>>;

const DAY_MS = 24 * 60 * 60 * 1000;

function getMetric(p: HistoryPoint, key: MarketMetricKey): number | undefined {
  return p[key as keyof HistoryPoint] as number | undefined;
}

/** Tìm điểm lịch sử cách hiện tại ~targetMs (mặc định 24h). Lấy điểm gần nhất nhưng cũ hơn now-target. */
function findReferencePoint(
  history: HistoryPoint[],
  key: MarketMetricKey,
  targetMs = DAY_MS,
): HistoryPoint | undefined {
  if (history.length === 0) return undefined;
  const cutoff = Date.now() - targetMs;
  // duyệt từ cuối, tìm điểm cũ hơn cutoff và có giá trị key
  for (let i = history.length - 1; i >= 0; i--) {
    const p = history[i];
    const t = new Date(p.timestamp).getTime();
    if (t <= cutoff && getMetric(p, key) != null) return p;
  }
  // fallback: điểm cũ nhất có giá trị
  for (const p of history) {
    if (getMetric(p, key) != null) return p;
  }
  return undefined;
}

export function computeMarketChanges(
  history: HistoryPoint[],
  current: Partial<Record<MarketMetricKey, number>>,
): MarketChanges {
  const keys: MarketMetricKey[] = [
    "sjcSell",
    "nhanSell",
    "gold",
    "silver",
    "usdVnd",
    "goldWorldVnd",
  ];
  const out: MarketChanges = {};

  for (const key of keys) {
    const value = current[key];
    if (value == null || !Number.isFinite(value)) continue;

    const ref = findReferencePoint(history, key);
    if (!ref) continue;
    const prev = getMetric(ref, key);
    if (prev == null || prev === 0) continue;

    const diff = value - prev;
    const pct = (diff / prev) * 100;
    out[key] = {
      value,
      prev,
      diff,
      pct,
      comparedAt: ref.timestamp,
    };
  }

  return out;
}
