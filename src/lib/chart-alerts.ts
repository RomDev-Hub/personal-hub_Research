import type { ChartSeriesKey } from "./chart-series";
import type { AlertAsset, PriceAlert } from "./types";

export const ALERT_TO_SERIES: Record<AlertAsset, ChartSeriesKey> = {
  gold: "gold",
  silver: "silver",
  usdVnd: "usdVnd",
  sjcSell: "sjcSell",
  nhanSell: "nhanSell",
};

export function alertsForChart(alerts: PriceAlert[]): PriceAlert[] {
  return alerts.filter((a) => a.enabled && (a.upper != null || a.lower != null));
}
