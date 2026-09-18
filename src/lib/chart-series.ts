import type { HistoryPoint } from "./types";

export type ChartSeriesKey =
  | "gold"
  | "silver"
  | "sjcSell"
  | "nhanSell"
  | "goldWorldVnd"
  | "silverVnd"
  | "usdVnd";

export type ChartAxisId = "vnd" | "usd" | "rate";

export interface ChartSeriesDef {
  key: ChartSeriesKey;
  label: string;
  color: string;
  axis: ChartAxisId;
  /** Giá trị trong history (triệu VND hoặc USD) */
  unitLabel: string;
  defaultOn: boolean;
  getValue: (p: HistoryPoint) => number | undefined;
}

export const CHART_SERIES: ChartSeriesDef[] = [
  {
    key: "sjcSell",
    label: "SJC (bán)",
    color: "#eab308",
    axis: "vnd",
    unitLabel: "triệu/lượng",
    defaultOn: true,
    getValue: (p) => p.sjcSell,
  },
  {
    key: "nhanSell",
    label: "SJC nhẫn (bán)",
    color: "#6366f1",
    axis: "vnd",
    unitLabel: "triệu/lượng",
    defaultOn: true,
    getValue: (p) => p.nhanSell,
  },
  {
    key: "goldWorldVnd",
    label: "Vàng TG (VNĐ)",
    color: "#22d3ee",
    axis: "vnd",
    unitLabel: "triệu/lượng",
    defaultOn: true,
    getValue: (p) => p.goldWorldVnd,
  },
  {
    key: "silverVnd",
    label: "Bạc TG (VNĐ)",
    color: "#a78bfa",
    axis: "vnd",
    unitLabel: "triệu/kg",
    defaultOn: false,
    getValue: (p) => p.silverVnd,
  },
  {
    key: "gold",
    label: "Vàng TG (USD)",
    color: "#f59e0b",
    axis: "usd",
    unitLabel: "USD/oz",
    defaultOn: false,
    getValue: (p) => p.gold,
  },
  {
    key: "silver",
    label: "Bạc TG (USD)",
    color: "#94a3b8",
    axis: "usd",
    unitLabel: "USD/oz",
    defaultOn: false,
    getValue: (p) => p.silver,
  },
  {
    key: "usdVnd",
    label: "USD/VND",
    color: "#22c55e",
    axis: "rate",
    unitLabel: "VND",
    defaultOn: false,
    getValue: (p) => p.usdVnd,
  },
];

export const DEFAULT_SERIES_KEYS = CHART_SERIES.filter((s) => s.defaultOn).map((s) => s.key);
