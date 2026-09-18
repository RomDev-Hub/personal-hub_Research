import type { ForexSnapshot } from "./types";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD";

const RATE_LABELS: Record<string, string> = {
  VND: "Đồng Việt Nam",
  EUR: "Euro",
  GBP: "Bảng Anh",
  JPY: "Yên Nhật",
  CNY: "Nhân dân tệ",
  KRW: "Won Hàn",
  SGD: "Đô Singapore",
  THB: "Baht Thái",
  AUD: "Đô Úc",
  CHF: "Franc Thụy Sĩ",
};

async function fetchVndFallback(): Promise<number | undefined> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates?.VND;
  } catch {
    return undefined;
  }
}

export async function fetchForex(): Promise<ForexSnapshot> {
  let data: { base: string; date: string; rates: Record<string, number> };

  try {
    const res = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error("Frankfurter failed");
    data = (await res.json()) as typeof data;
  } catch {
    const vnd = await fetchVndFallback();
    data = {
      base: "USD",
      date: new Date().toISOString().slice(0, 10),
      rates: vnd ? { VND: vnd } : {},
    };
  }

  if (!data.rates.VND) {
    const vnd = await fetchVndFallback();
    if (vnd) data.rates.VND = vnd;
  }

  const priority = ["VND", "EUR", "GBP", "JPY", "CNY", "SGD", "KRW", "THB", "AUD", "CHF"];
  const codes = [
    ...priority.filter((c) => data.rates[c]),
    ...Object.keys(data.rates).filter((c) => !priority.includes(c)),
  ].slice(0, 12);

  return {
    base: data.base,
    updatedAt: data.date,
    rates: codes.map((code) => ({
      code,
      name: RATE_LABELS[code] ?? code,
      rate: data.rates[code],
    })),
  };
}

export function vndPerUsd(snapshot: ForexSnapshot): number | undefined {
  return snapshot.rates.find((r) => r.code === "VND")?.rate;
}
