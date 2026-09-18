export type MetalKey = "gold" | "silver";

export interface MetalSpot {
  key: MetalKey;
  name: string;
  priceUsd: number;
  unit: string;
  change24h?: number;
  updatedAt: string;
}

export interface ForexRate {
  code: string;
  name: string;
  rate: number;
}

export interface ForexSnapshot {
  base: string;
  rates: ForexRate[];
  updatedAt: string;
}

export interface HistoryPoint {
  timestamp: string;
  gold?: number;
  silver?: number;
  usdVnd?: number;
  eurUsd?: number;
  /** triệu VND / lượng */
  sjcSell?: number;
  sjcBuy?: number;
  nhanSell?: number;
  nhanBuy?: number;
  goldWorldVnd?: number;
  /** triệu VND / kg (ước tính từ bạc TG) */
  silverVnd?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  category: string;
  publishedAt: string;
  summary?: string;
}

export interface GitHubRepo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  todayStars: number;
}

export interface TelegramStatus {
  configured: boolean;
  botUsername?: string;
  chatId?: string;
  /** Cảnh báo khi Chat ID sai định dạng (vd @tên_bot). */
  chatIdError?: string;
  lastError?: string;
}

export type AlertAsset = "gold" | "silver" | "usdVnd" | "sjcSell" | "nhanSell";

export type ChartRange = "24h" | "7d" | "30d" | "1y" | "5y";

export interface PriceAlert {
  id: string;
  asset: AlertAsset;
  upper: number | null;
  lower: number | null;
  enabled: boolean;
  notifyTelegram: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  lastTriggeredSide?: "upper" | "lower";
}

export interface TriggeredAlert {
  alertId: string;
  asset: AlertAsset;
  side: "upper" | "lower";
  threshold: number;
  currentValue: number;
  at: string;
}

export type ScheduleAction = "digest" | "market" | "custom";

export interface ScheduleJob {
  id: string;
  name: string;
  time: string;
  days: number[];
  action: ScheduleAction;
  customMessage?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunDate?: string;
}

export interface HubTickResult {
  schedulesRan: Array<{ jobId: string; name: string; ok: boolean; error?: string }>;
  telegram: { processed: number; replied: number; autoReplyEnabled: boolean };
  at: string;
}
