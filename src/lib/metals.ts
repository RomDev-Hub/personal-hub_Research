import type { MetalSpot } from "./types";

const METALS_LIVE_URL = "https://api.metals.live/v1/spot";

interface MetalsLiveResponse {
  gold?: number;
  silver?: number;
  timestamp?: string;
}

async function fetchMetalsLive(): Promise<MetalsLiveResponse | null> {
  try {
    const res = await fetch(METALS_LIVE_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as MetalsLiveResponse;
  } catch {
    return null;
  }
}

async function fetchGoldApiFallback(): Promise<{ gold?: number; silver?: number }> {
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU", { signal: AbortSignal.timeout(8000) }),
      fetch("https://api.gold-api.com/price/XAG", { signal: AbortSignal.timeout(8000) }),
    ]);
    const gold = goldRes.ok ? ((await goldRes.json()) as { price?: number }).price : undefined;
    const silver = silverRes.ok ? ((await silverRes.json()) as { price?: number }).price : undefined;
    return { gold, silver };
  } catch {
    return {};
  }
}

export async function fetchMetalSpots(): Promise<MetalSpot[]> {
  const live = await fetchMetalsLive();
  let gold = live?.gold;
  let silver = live?.silver;

  if (!gold || !silver) {
    const fallback = await fetchGoldApiFallback();
    gold = gold ?? fallback.gold;
    silver = silver ?? fallback.silver;
  }

  if (!gold && !silver) {
    gold = 2350;
    silver = 28.5;
  }

  const updatedAt = live?.timestamp ?? new Date().toISOString();

  return [
    {
      key: "gold",
      name: "Vàng (XAU)",
      priceUsd: gold ?? 0,
      unit: "USD/oz",
      updatedAt,
    },
    {
      key: "silver",
      name: "Bạc (XAG)",
      priceUsd: silver ?? 0,
      unit: "USD/oz",
      updatedAt,
    },
  ];
}
