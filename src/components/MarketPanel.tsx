"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { ChartSeriesKey } from "@/lib/chart-series";
import type {
  AlertAsset,
  ChartRange,
  ForexSnapshot,
  HistoryPoint,
  MetalSpot,
  PriceAlert,
  TriggeredAlert,
} from "@/lib/types";
import type { VnGoldSnapshot } from "@/lib/vn-gold";
import type { MarketChanges } from "@/lib/market-changes";
import { formatNumber, formatUsd, formatVnd } from "@/lib/format";
import { ALERT_ASSET_LABELS } from "@/lib/alert-constants";
import { AlertToasts } from "./AlertToasts";
import { Card } from "./Card";
import { MarketChart } from "./MarketChart";
import { MarketStatus } from "./MarketStatus";
import { PriceAlertsPanel } from "./PriceAlertsPanel";
import { StatCard } from "./StatCard";
import { useHubBrowserPause } from "@/lib/use-hub-browser-pause";

interface MarketData {
  metals: MetalSpot[];
  forex: ForexSnapshot;
  vnGold?: VnGoldSnapshot;
  history: HistoryPoint[];
  chartHistory?: HistoryPoint[];
  chartRange?: ChartRange;
  current?: Partial<Record<ChartSeriesKey, number>>;
  changes?: MarketChanges;
  alerts?: PriceAlert[];
  vndPerOz?: number;
  triggeredAlerts?: TriggeredAlert[];
  fetchedAt?: string;
  pollMs?: number;
}

const RANGES: { id: ChartRange; label: string }[] = [
  { id: "24h", label: "24 giờ" },
  { id: "7d", label: "7 ngày" },
  { id: "30d", label: "30 ngày" },
  { id: "1y", label: "1 năm" },
  { id: "5y", label: "5 năm" },
];

const POLL_MS = Number(process.env.NEXT_PUBLIC_MARKET_POLL_MS ?? 30_000);

export function MarketPanel({ compact = false }: { compact?: boolean }) {
  const browserPaused = useHubBrowserPause();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("7d");
  const [toasts, setToasts] = useState<TriggeredAlert[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const pushToasts = useCallback((triggered: TriggeredAlert[]) => {
    if (!triggered.length) return;
    setToasts((prev) => [...triggered, ...prev].slice(0, 5));
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      for (const t of triggered) {
        new Notification(`Cảnh báo: ${ALERT_ASSET_LABELS[t.asset]}`, {
          body: t.side === "upper" ? "Vượt ngưỡng trên" : "Xuống dưới ngưỡng dưới",
        });
      }
    }
  }, []);

  const load = useCallback(
    async (options?: { record?: boolean; silent?: boolean }) => {
      const record = options?.record ?? false;
      const silent = options?.silent ?? false;

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          record: record ? "1" : "0",
          chartRange,
          live: record ? "0" : "1",
        });
        const res = await fetch(`/api/market?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Không tải được dữ liệu thị trường");
        const json = (await res.json()) as MarketData & { error?: string };
        if (json.error) throw new Error(json.error);
        setData(json);
        if (json.alerts) setAlerts(json.alerts);
        if (json.triggeredAlerts?.length) pushToasts(json.triggeredAlerts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi không xác định");
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [chartRange, pushToasts],
  );

  useEffect(() => {
    if (
      !compact &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => undefined);
    }
  }, [compact]);

  useEffect(() => {
    if (browserPaused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load({ record: true });
    const id = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [load, browserPaused]);

  const gold = data?.metals.find((m) => m.key === "gold");
  const silver = data?.metals.find((m) => m.key === "silver");
  const vnd = data?.forex.rates.find((r) => r.code === "VND");
  const sjc = data?.vnGold?.spots.find((s) => s.code === "SJL1L10");
  const nhan = data?.vnGold?.spots.find((s) => s.code === "SJ9999");
  const changes = data?.changes ?? {};

  const chartHistory = data?.chartHistory ?? data?.history ?? [];
  const chartCurrent = data?.current ?? {};

  const currentPrices = useMemo<Partial<Record<AlertAsset, number>>>(
    () => ({
      gold: gold?.priceUsd,
      silver: silver?.priceUsd,
      usdVnd: vnd?.rate,
      sjcSell: chartCurrent.sjcSell,
      nhanSell: chartCurrent.nhanSell,
    }),
    [gold?.priceUsd, silver?.priceUsd, vnd?.rate, chartCurrent.sjcSell, chartCurrent.nhanSell],
  );

  const lastUpdated =
    data?.fetchedAt ?? data?.vnGold?.updatedAt ?? gold?.updatedAt ?? data?.forex.updatedAt;
  const sources = compact ? "giavang.now" : "giavang.now · metals.live · Frankfurter";

  return (
    <div className="space-y-5">
      <AlertToasts
        items={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => `${t.alertId}-${t.at}` !== id))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Thị trường vàng, bạc & USD</h2>
          <p className="text-sm text-[var(--muted)]">
            Theo dõi giá vàng SJC, vàng/bạc thế giới, tỷ giá USD — so với 24 giờ trước.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/market/history-csv"
            className="btn-secondary flex items-center gap-2"
            download={`price-history_${new Date().toISOString().slice(0, 10)}.csv`}
          >
            <Download className="h-4 w-4 shrink-0" />
            Xuất CSV lịch sử
          </a>
          <button
            type="button"
            onClick={() => load({ record: true })}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Ghi nhận điểm
          </button>
          <button type="button" onClick={() => load()} disabled={loading} className="btn-primary">
            Làm mới
          </button>
        </div>
      </div>

      <MarketStatus
        source={sources}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        error={error}
        pollMs={data?.pollMs ?? POLL_MS}
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <StatCard
          label="SJC (bán)"
          value={sjc ? formatVnd(sjc.sell) : "—"}
          sub="/ lượng"
          accent="gold"
          change={changes.sjcSell}
          formatDiff={(d) => formatVnd(d * 1_000_000)}
          loading={loading && !data}
        />
        <StatCard
          label="SJC nhẫn (bán)"
          value={nhan ? formatVnd(nhan.sell) : "—"}
          sub="/ chỉ"
          accent="silver"
          change={changes.nhanSell}
          formatDiff={(d) => formatVnd(d * 1_000_000)}
          loading={loading && !data}
        />
        <StatCard
          label="Vàng TG"
          value={gold ? formatUsd(gold.priceUsd) : "—"}
          sub="USD/oz"
          accent="muted"
          change={changes.gold}
          formatDiff={(d) => `${d > 0 ? "+" : ""}${d.toFixed(2)} $`}
          loading={loading && !data}
        />
        <StatCard
          label="Bạc TG"
          value={silver ? formatUsd(silver.priceUsd) : "—"}
          sub="USD/oz"
          accent="muted"
          change={changes.silver}
          formatDiff={(d) => `${d > 0 ? "+" : ""}${d.toFixed(2)} $`}
          loading={loading && !data}
        />
        <StatCard
          label="USD → VND"
          value={vnd ? formatNumber(vnd.rate) : "—"}
          sub="1 USD"
          accent="vnd"
          change={changes.usdVnd}
          formatDiff={(d) => `${d > 0 ? "+" : ""}${formatNumber(Math.round(d))}`}
          loading={loading && !data}
        />
        <StatCard
          label="Vàng TG quy đổi"
          value={data?.vndPerOz ? formatVnd(data.vndPerOz) : "—"}
          sub="ước tính / oz"
          accent="muted"
          loading={loading && !data}
        />
      </div>

      {!compact && (
        <>
          <section className="chart-hero space-y-3">
            <header className="chart-hero-header">
              <div>
                <h3 className="chart-hero-title">Biểu đồ lịch sử</h3>
                <p className="chart-hero-sub">
                  Tick chọn series để so sánh trên cùng biểu đồ · Lăn chuột zoom · Kéo pan
                </p>
              </div>
              <ChartRangeTabs range={chartRange} onChange={setChartRange} />
            </header>
            <MarketChart
              history={chartHistory}
              range={chartRange}
              current={chartCurrent}
              alerts={alerts}
              loading={loading && !chartHistory.length}
              hero
            />
          </section>

          <PriceAlertsPanel currentPrices={currentPrices} onAlertsChange={setAlerts} />

          <Card title="Tỷ giá USD" subtitle={`Frankfurter · ${data?.forex.updatedAt ?? "—"}`}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data?.forex.rates.map((r) => (
                <div
                  key={r.code}
                  className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2.5 text-sm"
                >
                  <span className="text-[var(--muted)]">
                    {r.name} ({r.code})
                  </span>
                  <span className="font-mono font-medium tabular-nums">{formatNumber(r.rate)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function ChartRangeTabs({ range, onChange }: { range: ChartRange; onChange: (r: ChartRange) => void }) {
  return (
    <div className="tab-pill-group">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`tab-pill ${range === r.id ? "tab-pill-active" : ""}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
