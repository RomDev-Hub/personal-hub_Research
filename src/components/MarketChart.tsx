"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { CHART_SERIES, DEFAULT_SERIES_KEYS, type ChartSeriesDef, type ChartSeriesKey } from "@/lib/chart-series";
import { ALERT_TO_SERIES, alertsForChart } from "@/lib/chart-alerts";
import {
  formatChartTooltipTime,
  formatRangeLabel,
  getRangeBounds,
  prepareChartHistory,
  prepareFullChartHistory,
  chartCoverageNote,
} from "@/lib/chart-utils";
import { formatChartTooltipSeriesValue } from "@/lib/format";
import { usdOzToVndPerLuong, silverUsdToVndPerKg } from "@/lib/vn-gold";
import type { ChartRange, HistoryPoint, PriceAlert } from "@/lib/types";
import { ChartSeriesLegend } from "./ChartSeriesLegend";
import { ChartTooltip, type ChartTooltipState } from "./ChartTooltip";

interface MarketChartProps {
  history: HistoryPoint[];
  range: ChartRange;
  current: Partial<Record<ChartSeriesKey, number>>;
  alerts?: PriceAlert[];
  loading?: boolean;
  hero?: boolean;
}

const STORAGE_KEY = "personal-hub-chart-series";

/** Không zoom nhỏ hơn ~2 ngày (dữ liệu daily). */
const MIN_VISIBLE_RANGE_SEC = 86400 * 2;

function loadEnabled(): Set<ChartSeriesKey> {
  if (typeof window === "undefined") return new Set(DEFAULT_SERIES_KEYS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as ChartSeriesKey[]);
  } catch {
    /* ignore */
  }
  return new Set(DEFAULT_SERIES_KEYS);
}

function toTime(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

function resolveValue(p: HistoryPoint, s: ChartSeriesDef, fallbackUsdVnd?: number): number | undefined {
  const usdVnd = p.usdVnd ?? fallbackUsdVnd;
  const v = s.getValue(p);
  if (v != null) return v;
  if (s.key === "goldWorldVnd" && p.gold && usdVnd) return usdOzToVndPerLuong(p.gold, usdVnd);
  if (s.key === "silverVnd" && p.silver && usdVnd) return silverUsdToVndPerKg(p.silver, usdVnd);
  return undefined;
}

function scaleId(axis: ChartSeriesDef["axis"]): string {
  if (axis === "vnd") return "vnd";
  if (axis === "usd") return "usd";
  return "rate";
}

function buildLineData(
  points: HistoryPoint[],
  s: ChartSeriesDef,
  fallbackUsdVnd?: number,
): LineData<Time>[] {
  const byTime = new Map<number, number>();
  for (const p of points) {
    const v = resolveValue(p, s, fallbackUsdVnd);
    if (v == null || !Number.isFinite(v)) continue;
    byTime.set(toTime(p.timestamp) as number, v);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

function pickNavigatorSeries(
  enabledKeys: Set<ChartSeriesKey>,
  points: HistoryPoint[],
  usdVnd?: number,
): ChartSeriesDef | null {
  for (const s of CHART_SERIES) {
    if (!enabledKeys.has(s.key)) continue;
    if (buildLineData(points, s, usdVnd).length >= 2) return s;
  }
  return null;
}

function clampVisibleRange(
  from: number,
  to: number,
  boundLo: number,
  boundHi: number,
  minSpan: number,
): { from: number; to: number } {
  let nf = from;
  let nt = to;
  if (nt - nf < minSpan) {
    const mid = (nf + nt) / 2;
    nf = mid - minSpan / 2;
    nt = mid + minSpan / 2;
  }
  nf = Math.max(boundLo, Math.min(nf, boundHi - minSpan));
  nt = Math.min(boundHi, Math.max(nt, boundLo + minSpan));
  return { from: nf, to: nt };
}

export function MarketChart({ history, range, current, alerts = [], loading, hero = false }: MarketChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<ChartSeriesKey, ISeriesApi<"Line", Time>>>(new Map());
  const priceLinesRef = useRef<Array<{ series: ISeriesApi<"Line", Time>; line: IPriceLine }>>([]);
  const enabledRef = useRef<Set<ChartSeriesKey>>(loadEnabled());
  const rangeRef = useRef<ChartRange>(range);
  const suppressVisibleSubscriptionRef = useRef(false);
  const prevToolbarRangeRef = useRef<ChartRange | undefined>(undefined);

  const navContainerRef = useRef<HTMLDivElement>(null);
  const navChartRef = useRef<IChartApi | null>(null);
  const navSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const brushTrackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "left" | "right" | "body";
    startClientX: number;
    from: number;
    to: number;
  } | null>(null);

  const plotPointsRef = useRef<HistoryPoint[]>([]);
  const navigatorSeriesRef = useRef<ChartSeriesDef | null>(null);
  const usdVndRef = useRef<number | undefined>(undefined);

  const [enabled, setEnabled] = useState<Set<ChartSeriesKey>>(() => loadEnabled());
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const [brushRect, setBrushRect] = useState<{ left: number; width: number } | null>(null);

  const usdVnd = current.usdVnd;
  const activeAlerts = useMemo(() => alertsForChart(alerts), [alerts]);

  const enrichedHistory = useMemo(() => {
    return history.map((p) => {
      const rate = p.usdVnd ?? usdVnd;
      return {
        ...p,
        goldWorldVnd:
          p.goldWorldVnd ?? (p.gold && rate ? usdOzToVndPerLuong(p.gold, rate) : undefined),
        silverVnd:
          p.silverVnd ?? (p.silver && rate ? silverUsdToVndPerKg(p.silver, rate) : undefined),
      };
    });
  }, [history, usdVnd]);

  const filtered = useMemo(() => prepareChartHistory(enrichedHistory, range), [enrichedHistory, range]);

  const fullDaily = useMemo(() => prepareFullChartHistory(enrichedHistory), [enrichedHistory]);

  const plotPoints = range === "24h" ? filtered : fullDaily;

  const navigatorSeries = useMemo(
    () => pickNavigatorSeries(enabled, plotPoints, usdVnd),
    [enabled, plotPoints, usdVnd],
  );

  useEffect(() => {
    plotPointsRef.current = plotPoints;
    usdVndRef.current = usdVnd;
    navigatorSeriesRef.current = navigatorSeries;
  }, [plotPoints, usdVnd, navigatorSeries]);

  const showNavigator = range !== "24h" && navigatorSeries != null && plotPoints.length >= 3;

  const { start: rangeStart, end: rangeEnd } = useMemo(() => getRangeBounds(range), [range]);

  const visibleSeries = useMemo(() => {
    return CHART_SERIES.filter((s) => {
      if (!enabled.has(s.key)) return false;
      const hasCurrent = current[s.key] != null;
      const hasHistory = plotPoints.some((p) => resolveValue(p, s, usdVnd) != null);
      return hasCurrent || hasHistory;
    });
  }, [enabled, plotPoints, current, usdVnd]);

  const legendCurrent = useMemo(() => {
    const out = { ...current };
    if (out.goldWorldVnd == null && out.gold && out.usdVnd) {
      out.goldWorldVnd = usdOzToVndPerLuong(out.gold, out.usdVnd);
    }
    if (out.silverVnd == null && out.silver && out.usdVnd) {
      out.silverVnd = silverUsdToVndPerKg(out.silver, out.usdVnd);
    }
    return out;
  }, [current]);

  const syncBrushFromMain = useCallback(() => {
    const main = chartRef.current;
    const nav = navChartRef.current;
    const track = brushTrackRef.current;
    if (!main || !nav || !track || rangeRef.current === "24h") return;
    const vr = main.timeScale().getVisibleRange();
    if (!vr) {
      setBrushRect(null);
      return;
    }
    const tsNav = nav.timeScale();
    const x1 = tsNav.timeToCoordinate(vr.from);
    const x2 = tsNav.timeToCoordinate(vr.to);
    if (x1 === null || x2 === null) {
      setBrushRect(null);
      return;
    }
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const w = track.clientWidth;
    const width = Math.max(10, Math.min(w, right - left));
    const clampedLeft = Math.max(0, Math.min(w - width, left));
    setBrushRect({ left: clampedLeft, width });
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabled]));
  }, [enabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 416,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b939e",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(30, 36, 48, 0.6)" },
        horzLines: { color: "rgba(30, 36, 48, 0.6)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: "#252a33",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    chartRef.current = chart;
    seriesRef.current = new Map();
    priceLinesRef.current = [];

    const onVisibleTimeRangeChange = () => {
      if (suppressVisibleSubscriptionRef.current) return;
      syncBrushFromMain();
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleTimeRangeChange);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      syncBrushFromMain();
    });
    ro.observe(el);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point === undefined || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }
      const rows: ChartTooltipState["rows"] = [];
      for (const s of CHART_SERIES) {
        if (!enabledRef.current.has(s.key)) continue;
        const series = seriesRef.current.get(s.key);
        if (!series) continue;
        const item = param.seriesData.get(series);
        if (!item || !("value" in item) || item.value == null) continue;
        rows.push({
          label: s.label,
          value: formatChartTooltipSeriesValue(s.key, item.value as number, rangeRef.current),
          color: s.color,
        });
      }
      if (rows.length === 0) {
        setTooltip(null);
        return;
      }
      const sec = typeof param.time === "number" ? param.time : 0;
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        time: formatChartTooltipTime(new Date(sec * 1000).toISOString()),
        rows,
      });
    });

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeChange);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current.clear();
      priceLinesRef.current = [];
      setTooltip(null);
    };
  }, [loading, syncBrushFromMain]);

  useEffect(() => {
    rangeRef.current = range;
    chartRef.current?.applyOptions({
      timeScale: { secondsVisible: range === "24h" },
    });
  }, [range]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || loading) return;

    const activeKeys = new Set(visibleSeries.map((s) => s.key));
    for (const key of [...seriesRef.current.keys()]) {
      if (!activeKeys.has(key)) {
        const s = seriesRef.current.get(key);
        if (s) chart.removeSeries(s);
        seriesRef.current.delete(key);
      }
    }

    for (const s of visibleSeries) {
      let series = seriesRef.current.get(s.key);
      if (!series) {
        series = chart.addSeries(LineSeries, {
          color: s.color,
          lineWidth: 2,
          priceScaleId: scaleId(s.axis),
          crosshairMarkerVisible: plotPoints.length < 80,
          lastValueVisible: true,
          priceLineVisible: false,
        });
        seriesRef.current.set(s.key, series);
      } else {
        series.applyOptions({
          color: s.color,
          visible: true,
          crosshairMarkerVisible: plotPoints.length < 80,
        });
      }

      const lineData = buildLineData(plotPoints, s, usdVnd);
      if (lineData.length > 0) series.setData(lineData);
    }

    for (const { series, line } of priceLinesRef.current) {
      series.removePriceLine(line);
    }
    priceLinesRef.current = [];

    for (const alert of activeAlerts) {
      const seriesKey = ALERT_TO_SERIES[alert.asset];
      if (!enabled.has(seriesKey)) continue;
      const series = seriesRef.current.get(seriesKey);
      if (!series) continue;

      if (alert.upper != null) {
        priceLinesRef.current.push({
          series,
          line: series.createPriceLine({
            price: alert.upper,
            color: "#f87171",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Trên",
          }),
        });
      }
      if (alert.lower != null) {
        priceLinesRef.current.push({
          series,
          line: series.createPriceLine({
            price: alert.lower,
            color: "#4ade80",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "Dưới",
          }),
        });
      }
    }

    const ts = chart.timeScale();
    const hasAnySeriesData = visibleSeries.some((s) => buildLineData(plotPoints, s, usdVnd).length > 0);
    if (hasAnySeriesData && plotPoints.length > 0 && range === "24h") {
      try {
        const from = Math.floor(rangeStart / 1000) as UTCTimestamp;
        const to = Math.floor(rangeEnd / 1000) as UTCTimestamp;
        ts.setVisibleRange({ from, to });
      } catch {
        ts.fitContent();
      }
    }

    const scaleStyle = {
      scaleMargins: { top: 0.08, bottom: 0.12 },
      borderColor: "#252a33",
      visible: true,
    };
    const activeScaleIds = new Set(visibleSeries.map((s) => scaleId(s.axis)));
    for (const id of activeScaleIds) {
      chart.priceScale(id).applyOptions(scaleStyle);
    }
  }, [visibleSeries, plotPoints, range, rangeStart, rangeEnd, usdVnd, loading, activeAlerts, enabled]);

  /* Toolbar preset → cửa sổ thời gian (multi-day); không reset khi chỉ append điểm. */
  useEffect(() => {
    if (loading) return;
    if (range === "24h") {
      prevToolbarRangeRef.current = range;
      return;
    }
    if (plotPoints.length < 2 || !navigatorSeries) return;
    const chart = chartRef.current;
    if (!chart) return;

    const toolbarChanged = prevToolbarRangeRef.current !== range;
    prevToolbarRangeRef.current = range;
    if (!toolbarChanged) return;

    const ld = buildLineData(plotPoints, navigatorSeries, usdVnd);
    if (ld.length < 2) return;
    const firstT = ld[0].time as number;
    const lastT = ld[ld.length - 1].time as number;
    const { start, end } = getRangeBounds(range);
    const from = Math.max(firstT, Math.floor(start / 1000));
    const to = Math.min(lastT, Math.floor(end / 1000));
    const ts = chart.timeScale();
    suppressVisibleSubscriptionRef.current = true;
    try {
      if (from >= to) ts.fitContent();
      else ts.setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
    } catch {
      ts.fitContent();
    }
    requestAnimationFrame(() => {
      suppressVisibleSubscriptionRef.current = false;
      syncBrushFromMain();
    });
  }, [range, loading, plotPoints, navigatorSeries, usdVnd, syncBrushFromMain]);

  /* Navigator lane chart */
  useEffect(() => {
    const el = navContainerRef.current;
    if (!el || loading || range === "24h" || !navigatorSeries) {
      if (navChartRef.current) {
        navChartRef.current.remove();
        navChartRef.current = null;
        navSeriesRef.current = null;
      }
      setBrushRect(null);
      return;
    }

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 76,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: "#252a33",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    navChartRef.current = chart;
    const navSeries = chart.addSeries(LineSeries, {
      color: navigatorSeries.color,
      lineWidth: 1,
      priceScaleId: scaleId(navigatorSeries.axis),
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    navSeriesRef.current = navSeries;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      syncBrushFromMain();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      navChartRef.current = null;
      navSeriesRef.current = null;
      setBrushRect(null);
    };
  }, [loading, range, navigatorSeries, syncBrushFromMain]);

  /* Navigator data + fit */
  useEffect(() => {
    const chart = navChartRef.current;
    const navSeries = navSeriesRef.current;
    if (!chart || !navSeries || range === "24h" || !navigatorSeries || plotPoints.length < 2) return;

    const ld = buildLineData(plotPoints, navigatorSeries, usdVnd);
    if (ld.length === 0) return;
    navSeries.applyOptions({ color: navigatorSeries.color });
    navSeries.setData(ld);
    chart.timeScale().fitContent();
    queueMicrotask(() => syncBrushFromMain());
  }, [plotPoints, navigatorSeries, usdVnd, range, syncBrushFromMain]);

  const applyMainVisible = useCallback((from: number, to: number) => {
    const main = chartRef.current;
    const nav = navChartRef.current;
    const seriesDef = navigatorSeriesRef.current;
    const pts = plotPointsRef.current;
    const uv = usdVndRef.current;
    if (!main || !nav || !seriesDef || pts.length < 2) return;
    const ld = buildLineData(pts, seriesDef, uv);
    const boundLo = ld[0].time as number;
    const boundHi = ld[ld.length - 1].time as number;
    const { from: nf, to: nt } = clampVisibleRange(from, to, boundLo, boundHi, MIN_VISIBLE_RANGE_SEC);
    suppressVisibleSubscriptionRef.current = true;
    try {
      main.timeScale().setVisibleRange({ from: nf as UTCTimestamp, to: nt as UTCTimestamp });
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      suppressVisibleSubscriptionRef.current = false;
      syncBrushFromMain();
    });
  }, [syncBrushFromMain]);

  const timeFromTrackX = useCallback((nav: IChartApi, track: HTMLElement, clientX: number): number | null => {
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = nav.timeScale().coordinateToTime(x);
    if (t === null || typeof t !== "number") return null;
    return t;
  }, []);

  const onBrushPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!showNavigator || rangeRef.current === "24h") return;
      const main = chartRef.current;
      const nav = navChartRef.current;
      const track = brushTrackRef.current;
      if (!main || !nav || !track) return;
      const vr = main.timeScale().getVisibleRange();
      if (!vr) return;
      const from = vr.from as number;
      const to = vr.to as number;

      if (!brushRect) {
        const tJump = timeFromTrackX(nav, track, e.clientX);
        if (tJump !== null) {
          const span = to - from;
          applyMainVisible(tJump - span / 2, tJump + span / 2);
        }
        return;
      }

      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const EDGE = 14;
      const bL = brushRect.left;
      const bR = brushRect.left + brushRect.width;
      let mode: "left" | "right" | "body";
      if (x >= bL - EDGE && x <= bL + EDGE) mode = "left";
      else if (x >= bR - EDGE && x <= bR + EDGE) mode = "right";
      else if (x > bL && x < bR) mode = "body";
      else {
        const tJump = timeFromTrackX(nav, track, e.clientX);
        if (tJump !== null) {
          const span = to - from;
          applyMainVisible(tJump - span / 2, tJump + span / 2);
        }
        return;
      }

      dragRef.current = { mode, startClientX: e.clientX, from, to };
      track.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        const m = chartRef.current;
        const n = navChartRef.current;
        const tr = brushTrackRef.current;
        if (!d || !m || !n || !tr) return;

        const seriesDef = navigatorSeriesRef.current;
        const pts = plotPointsRef.current;
        if (!seriesDef || pts.length < 2) return;

        if (d.mode === "body") {
          const t0 = timeFromTrackX(n, tr, d.startClientX);
          const t1 = timeFromTrackX(n, tr, ev.clientX);
          if (t0 === null || t1 === null) return;
          const dt = t1 - t0;
          applyMainVisible(d.from + dt, d.to + dt);
          return;
        }

        const tAt = timeFromTrackX(n, tr, ev.clientX);
        if (tAt === null) return;

        if (d.mode === "left") {
          applyMainVisible(tAt, d.to);
        } else {
          applyMainVisible(d.from, tAt);
        }
      };

      const onUp = (ev: PointerEvent) => {
        dragRef.current = null;
        track.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [applyMainVisible, brushRect, showNavigator, timeFromTrackX],
  );

  const toggle = (key: ChartSeriesKey) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const rangeCaption =
    range === "24h"
      ? formatRangeLabel(range, filtered)
      : `${plotPoints.length} điểm (gộp ngày) · ${formatRangeLabel(range, plotPoints)}`;

  const coverageNote =
    range === "24h" ? chartCoverageNote(range, filtered) : chartCoverageNote(range, plotPoints);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-16 rounded-xl" />
        <div className={`skeleton trading-chart rounded-xl ${hero ? "trading-chart-hero" : ""}`} />
      </div>
    );
  }

  if (plotPoints.length < 1) {
    return (
      <div className="chart-empty chart-empty-sm">
        <p className="text-sm font-medium">Chưa có dữ liệu trong khoảng {range}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Chọn khoảng khác hoặc nhấn &quot;Ghi nhận điểm&quot; để tích lũy lịch sử.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ChartSeriesLegend enabled={enabled} onToggle={toggle} current={legendCurrent} compact />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <span>{rangeCaption}</span>
        <span>
          Lăn chuột: zoom · Kéo: pan
          {showNavigator ? " · Thanh dưới: chọn khoảng (kéo viền / giữa)" : ""}
        </span>
      </div>
      {coverageNote && <p className="text-[10px] text-amber-500/90">{coverageNote}</p>}

      <div ref={wrapRef} className="relative">
        <div ref={containerRef} className={`trading-chart ${hero ? "trading-chart-hero" : ""}`} />
        <ChartTooltip state={tooltip} />
      </div>

      {showNavigator && (
        <div className="space-y-1">
          <div
            ref={brushTrackRef}
            className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            role="presentation"
            onPointerDown={onBrushPointerDown}
          >
            <div ref={navContainerRef} className="pointer-events-none trading-chart-nav w-full" />
            {brushRect ? (
              <div className="pointer-events-none absolute inset-0 z-[1]">
                <div
                  className="pointer-events-none absolute top-1 bottom-1 rounded-sm border border-sky-400/90 bg-sky-500/15 shadow-[0_0_10px_rgba(56,189,248,0.35)]"
                  style={{ left: brushRect.left, width: brushRect.width }}
                />
              </div>
            ) : null}
          </div>
          <p className="text-[10px] text-[var(--muted)]">
            Toàn bộ lịch sử (ngày) — vùng sáng khớp khung đang xem · kéo viền để zoom · kéo giữa để dịch · click
            ra ngoài vùng để nhảy tới vị trí.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
        <div className="flex flex-wrap gap-3">
          {visibleSeries.some((s) => s.axis === "vnd") && <span>Trái: triệu VND</span>}
          {visibleSeries.some((s) => s.axis === "usd") && <span>Phải: USD/oz</span>}
          {visibleSeries.some((s) => s.axis === "rate") && <span>Phải: USD/VND</span>}
          {activeAlerts.length > 0 && (
            <span className="text-red-400/80">— đỏ: trên · xanh: dưới</span>
          )}
        </div>
        <a
          href="https://www.tradingview.com/lightweight-charts/"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-50 hover:opacity-80"
        >
          Lightweight Charts
        </a>
      </div>
    </div>
  );
}
