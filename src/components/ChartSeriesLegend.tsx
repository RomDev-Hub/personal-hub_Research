"use client";

import { CHART_SERIES, type ChartSeriesKey } from "@/lib/chart-series";
import { formatChartSeriesValue } from "@/lib/format";

interface ChartSeriesLegendProps {
  enabled: Set<ChartSeriesKey>;
  onToggle: (key: ChartSeriesKey) => void;
  current: Partial<Record<ChartSeriesKey, number>>;
  compact?: boolean;
}

export function ChartSeriesLegend({ enabled, onToggle, current, compact }: ChartSeriesLegendProps) {
  const rows = compact
    ? CHART_SERIES.filter((s) => current[s.key] != null || enabled.has(s.key))
    : CHART_SERIES;

  return (
    <div className={compact ? "chart-legend-grid chart-legend-grid-compact" : "chart-legend-grid"}>
      {rows.map((s) => {
        const value = current[s.key];
        const on = enabled.has(s.key);
        return (
          <label
            key={s.key}
            className={`chart-legend-item ${compact ? "chart-legend-item-compact" : ""} ${on ? "chart-legend-item-on" : ""}`}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(s.key)}
              className="chart-legend-checkbox"
            />
            <span className="chart-legend-line" style={{ background: s.color }} />
            <span className="chart-legend-label">{s.label}</span>
            <span className="chart-legend-price font-mono tabular-nums">
              {value != null ? formatChartSeriesValue(s.key, value) : "—"}
            </span>
          </label>
        );
      })}
    </div>
  );
}
