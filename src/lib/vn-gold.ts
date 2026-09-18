import type { HistoryPoint } from "./types";

const GIAVANG_URL = "https://giavang.now/api/prices";
const LUONG_GRAMS = 37.5;
const OZ_GRAMS = 31.1034768;

export interface VnGoldSpot {
  code: string;
  name: string;
  buy: number;
  sell: number;
  currency: "VND" | "USD";
  changeBuy?: number;
  changeSell?: number;
}

export interface VnGoldSnapshot {
  updatedAt: string;
  spots: VnGoldSpot[];
  /** Giá thế giới quy đổi triệu VND / lượng */
  worldVndPerLuong?: number;
}

interface GiavangPrice {
  name: string;
  buy: number;
  sell: number;
  change_buy?: number;
  change_sell?: number;
  currency: string;
}

interface GiavangCurrentResponse {
  success: boolean;
  date?: string;
  time?: string;
  timestamp?: number;
  prices: Record<string, GiavangPrice>;
}

interface GiavangHistoryDay {
  date: string;
  prices: Record<string, GiavangPrice>;
}

interface GiavangHistoryResponse {
  success: boolean;
  days: number;
  type: string;
  history: GiavangHistoryDay[];
}

const TRACKED_CODES = ["XAUUSD", "SJL1L10", "SJ9999"] as const;

export function usdOzToVndPerLuong(usdOz: number, usdVnd: number): number {
  return (usdOz * (LUONG_GRAMS / OZ_GRAMS) * usdVnd) / 1_000_000;
}

export function silverUsdToVndPerKg(usdOz: number, usdVnd: number): number {
  const usdPerKg = usdOz * (1000 / OZ_GRAMS);
  return (usdPerKg * usdVnd) / 1_000_000;
}

export async function fetchVnGoldSnapshot(usdVnd?: number): Promise<VnGoldSnapshot> {
  try {
    const res = await fetch(GIAVANG_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "PersonalHub/1.0 (local)" },
    });
    if (!res.ok) throw new Error("giavang HTTP " + res.status);

    const data = (await res.json()) as GiavangCurrentResponse;
    if (!data.success || !data.prices) throw new Error("giavang invalid");

    const spots: VnGoldSpot[] = [];

    for (const code of TRACKED_CODES) {
      const p = data.prices[code];
      if (!p) continue;
      spots.push({
        code,
        name: mapName(code, p.name),
        buy: p.buy,
        sell: p.sell,
        currency: code === "XAUUSD" ? "USD" : "VND",
        changeBuy: p.change_buy,
        changeSell: p.change_sell,
      });
    }

    const xau = data.prices.XAUUSD;
    const worldVndPerLuong =
      xau && usdVnd ? usdOzToVndPerLuong(xau.sell || xau.buy, usdVnd) : undefined;

    const updatedAt =
      data.date && data.time
        ? `${data.date}T${data.time}:00`
        : new Date((data.timestamp ?? Date.now() / 1000) * 1000).toISOString();

    return { updatedAt, spots, worldVndPerLuong };
  } catch {
    return { updatedAt: new Date().toISOString(), spots: [] };
  }
}

function mapName(code: string, fallback: string): string {
  const map: Record<string, string> = {
    XAUUSD: "Vàng thế giới",
    SJL1L10: "SJC (lượng)",
    SJ9999: "SJC nhẫn",
  };
  return map[code] ?? fallback;
}

export async function fetchVnGoldHistory(days: number, usdVnd?: number): Promise<HistoryPoint[]> {
  const types = ["SJL1L10", "SJ9999", "XAUUSD"] as const;
  const byDate = new Map<string, HistoryPoint>();

  await Promise.all(
    types.map(async (type) => {
      try {
        const res = await fetch(`${GIAVANG_URL}?type=${type}&days=${days}`, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "PersonalHub/1.0 (local)" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as GiavangHistoryResponse;
        if (!data.success || !data.history) return;

        for (const day of data.history) {
          const p = day.prices[type];
          if (!p) continue;
          const ts = `${day.date}T12:00:00.000Z`;
          const existing = byDate.get(day.date) ?? { timestamp: ts };

          if (type === "SJL1L10") {
            existing.sjcSell = p.sell / 1_000_000;
            existing.sjcBuy = p.buy / 1_000_000;
          } else if (type === "SJ9999") {
            existing.nhanSell = p.sell / 1_000_000;
            existing.nhanBuy = p.buy / 1_000_000;
          } else if (type === "XAUUSD") {
            existing.gold = p.sell || p.buy;
            if (usdVnd) {
              existing.goldWorldVnd = usdOzToVndPerLuong(existing.gold, usdVnd);
            }
          }

          byDate.set(day.date, existing);
        }
      } catch {
        /* skip type */
      }
    }),
  );

  return [...byDate.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function snapshotToHistoryFields(
  snapshot: VnGoldSnapshot,
  usdVnd?: number,
  silverUsd?: number,
): Partial<HistoryPoint> {
  const sjc = snapshot.spots.find((s) => s.code === "SJL1L10");
  const nhan = snapshot.spots.find((s) => s.code === "SJ9999");
  const xau = snapshot.spots.find((s) => s.code === "XAUUSD");

  return {
    sjcSell: sjc ? sjc.sell / 1_000_000 : undefined,
    sjcBuy: sjc ? sjc.buy / 1_000_000 : undefined,
    nhanSell: nhan ? nhan.sell / 1_000_000 : undefined,
    nhanBuy: nhan ? nhan.buy / 1_000_000 : undefined,
    gold: xau?.sell || xau?.buy,
    goldWorldVnd: snapshot.worldVndPerLuong,
    silverVnd:
      silverUsd && usdVnd ? silverUsdToVndPerKg(silverUsd, usdVnd) : undefined,
  };
}
