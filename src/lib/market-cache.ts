import { fetchForex } from "./forex";
import { fetchMetalSpots } from "./metals";
import type { ChartRange, ForexSnapshot, HistoryPoint, MetalSpot } from "./types";
import { fetchVnGoldHistory, fetchVnGoldSnapshot, type VnGoldSnapshot } from "./vn-gold";
import { historyDaysForRange, mergeHistory, prepareChartHistory } from "./chart-utils";
const METALS_FOREX_TTL_MS = Number(process.env.MARKET_METALS_TTL_MS ?? 30_000);
const VN_SNAPSHOT_TTL_MS = Number(process.env.MARKET_VN_TTL_MS ?? 3_000);
const CHART_HISTORY_TTL_MS = Number(process.env.MARKET_CHART_TTL_MS ?? 30_000);

export const MARKET_RECORD_INTERVAL_MS = Number(process.env.MARKET_RECORD_MS ?? 60_000);

let metalsForexCache: { metals: MetalSpot[]; forex: ForexSnapshot; at: number } | null = null;
let vnSnapshotCache: { vn: VnGoldSnapshot; at: number } | null = null;
const vnHistoryCache = new Map<string, { history: HistoryPoint[]; at: number }>();
let lastAutoRecordAt = 0;

function fresh<T extends { at: number }>(entry: T | null, ttlMs: number): entry is T {
  return entry != null && Date.now() - entry.at < ttlMs;
}

export async function getMetalsAndForex(): Promise<{ metals: MetalSpot[]; forex: ForexSnapshot }> {
  if (fresh(metalsForexCache, METALS_FOREX_TTL_MS)) {
    return { metals: metalsForexCache.metals, forex: metalsForexCache.forex };
  }
  const [metals, forex] = await Promise.all([fetchMetalSpots(), fetchForex()]);
  metalsForexCache = { metals, forex, at: Date.now() };
  return { metals, forex };
}

export async function getVnGoldSnapshot(usdVnd?: number): Promise<VnGoldSnapshot> {
  if (fresh(vnSnapshotCache, VN_SNAPSHOT_TTL_MS)) {
    return vnSnapshotCache.vn;
  }
  const vn = await fetchVnGoldSnapshot(usdVnd);
  vnSnapshotCache = { vn, at: Date.now() };
  return vn;
}

export function invalidateChartHistoryCache(): void {
  vnHistoryCache.clear();
}

export function shouldAutoRecord(explicitRecord: boolean): boolean {
  if (explicitRecord) return true;
  return Date.now() - lastAutoRecordAt >= MARKET_RECORD_INTERVAL_MS;
}

export function markRecorded(): void {
  lastAutoRecordAt = Date.now();
}

export async function buildChartHistory(
  chartRange: ChartRange,
  localHistory: HistoryPoint[],
  usdVnd?: number,
  forceRefresh = false,
): Promise<HistoryPoint[]> {
  const cacheKey = `${chartRange}:${usdVnd ?? "na"}`;
  const cached = vnHistoryCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.at < CHART_HISTORY_TTL_MS) {
    return cached.history;
  }

  const days = historyDaysForRange(chartRange);
  const vnHistory = await fetchVnGoldHistory(days, usdVnd);
  const merged = mergeHistory(localHistory, vnHistory);
  const chartHistory = prepareChartHistory(merged, chartRange);
  vnHistoryCache.set(cacheKey, { history: chartHistory, at: Date.now() });
  return chartHistory;
}
