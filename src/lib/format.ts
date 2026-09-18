import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { ChartSeriesKey } from "./chart-series";
import type { ChartRange } from "./types";

export function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatDateTime(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: vi });
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi });
  } catch {
    return "";
  }
}

export function formatChartValue(value: number, asset: "gold" | "silver" | "usdVnd" | "eurUsd"): string {
  if (asset === "usdVnd") return formatNumber(value);
  if (asset === "eurUsd") return value.toFixed(4);
  return formatUsd(value);
}

export function formatChartTooltipSeriesValue(
  key: ChartSeriesKey,
  value: number,
  range: ChartRange,
): string {
  const fine = range === "24h";

  switch (key) {
    case "sjcSell":
    case "nhanSell":
    case "goldWorldVnd":
    case "silverVnd": {
      const dec = fine ? 4 : range === "7d" || range === "30d" ? 3 : 2;
      const vndApprox = Math.round(value * 1_000_000);
      return `${value.toFixed(dec)} tr (${formatVnd(vndApprox)})`;
    }
    case "gold":
    case "silver":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: fine ? 3 : 2,
        maximumFractionDigits: fine ? 4 : 2,
      }).format(value);
    case "usdVnd":
      return new Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: fine ? 3 : 0,
        maximumFractionDigits: fine ? 6 : 3,
      }).format(value);
    default:
      return String(value);
  }
}

/** Triệu VND (chart) hoặc USD/oz — hiển thị gọn (legend, trục) */
export function formatChartSeriesValue(key: ChartSeriesKey, value: number): string {
  switch (key) {
    case "sjcSell":
    case "nhanSell":
    case "goldWorldVnd":
    case "silverVnd":
      return `${value.toFixed(2)} tr`;
    case "gold":
    case "silver":
      return formatUsd(value);
    case "usdVnd":
      return formatNumber(value);
    default:
      return String(value);
  }
}
