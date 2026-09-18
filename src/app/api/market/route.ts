import { NextResponse } from "next/server";
import { evaluateAlerts, listAlerts } from "@/lib/alerts";
import { appendHistory, readHistory } from "@/lib/cache";
import type { ChartSeriesKey } from "@/lib/chart-series";
import {
  buildChartHistory,
  getMetalsAndForex,
  getVnGoldSnapshot,
  invalidateChartHistoryCache,
  markRecorded,
  shouldAutoRecord,
  MARKET_RECORD_INTERVAL_MS,
} from "@/lib/market-cache";
import { vndPerUsd } from "@/lib/forex";
import { computeMarketChanges } from "@/lib/market-changes";
import type { ChartRange } from "@/lib/types";
import {
  snapshotToHistoryFields,
  silverUsdToVndPerKg,
  usdOzToVndPerLuong,
} from "@/lib/vn-gold";

export const dynamic = "force-dynamic";

const POLL_MS = Number(process.env.NEXT_PUBLIC_MARKET_POLL_MS ?? process.env.MARKET_POLL_MS ?? 30_000);

function buildCurrentPrices(params: {
  gold?: number;
  silver?: number;
  usdVnd?: number;
  vn: Awaited<ReturnType<typeof getVnGoldSnapshot>>;
}): Partial<Record<ChartSeriesKey, number>> {
  const sjc = params.vn.spots.find((s) => s.code === "SJL1L10");
  const nhan = params.vn.spots.find((s) => s.code === "SJ9999");

  const xau = params.vn.spots.find((s) => s.code === "XAUUSD");
  const goldUsd = params.gold ?? xau?.sell ?? xau?.buy;
  const goldWorldVnd =
    params.vn.worldVndPerLuong ??
    (goldUsd && params.usdVnd ? usdOzToVndPerLuong(goldUsd, params.usdVnd) : undefined);

  return {
    gold: goldUsd,
    silver: params.silver,
    usdVnd: params.usdVnd,
    sjcSell: sjc ? sjc.sell / 1_000_000 : undefined,
    nhanSell: nhan ? nhan.sell / 1_000_000 : undefined,
    goldWorldVnd,
    silverVnd:
      params.silver && params.usdVnd
        ? silverUsdToVndPerKg(params.silver, params.usdVnd)
        : undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const explicitRecord = searchParams.get("record") === "1";
  const live = searchParams.get("live") !== "0";
  const chartRange = (searchParams.get("chartRange") ?? "7d") as ChartRange;
  const doRecord = shouldAutoRecord(explicitRecord);

  try {
    const { metals, forex } = await getMetalsAndForex();
    const gold = metals.find((m) => m.key === "gold")?.priceUsd;
    const silver = metals.find((m) => m.key === "silver")?.priceUsd;
    const usdVnd = vndPerUsd(forex);
    const eurRate = forex.rates.find((r) => r.code === "EUR")?.rate;

    const vnGold = await getVnGoldSnapshot(usdVnd);

    let history = await readHistory();
    let triggeredAlerts: Awaited<ReturnType<typeof evaluateAlerts>> = [];

    const current = buildCurrentPrices({ gold, silver, usdVnd, vn: vnGold });
    const vnFields = snapshotToHistoryFields(vnGold, usdVnd, silver);

    if (doRecord && gold && silver) {
      history = await appendHistory({
        gold,
        silver,
        usdVnd,
        eurUsd: eurRate,
        ...vnFields,
      });
      markRecorded();
      invalidateChartHistoryCache();
      triggeredAlerts = await evaluateAlerts({
        gold,
        silver,
        usdVnd,
        sjcSell: current.sjcSell,
        nhanSell: current.nhanSell,
      });
    }

    const chartHistory = await buildChartHistory(
      chartRange,
      history,
      usdVnd,
      !live || explicitRecord,
    );

    const alerts = await listAlerts();
    const changes = computeMarketChanges(history, current);

    return NextResponse.json({
      metals,
      forex,
      vnGold,
      history,
      chartHistory,
      chartRange,
      current,
      changes,
      alerts,
      vndPerOz: gold && usdVnd ? gold * usdVnd : undefined,
      triggeredAlerts,
      fetchedAt: new Date().toISOString(),
      pollMs: POLL_MS,
      recordMs: MARKET_RECORD_INTERVAL_MS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi thị trường" },
      { status: 500 },
    );
  }
}
