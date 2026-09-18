import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fetchForex, vndPerUsd } from "./forex";
import { fetchMetalSpots } from "./metals";
import { fetchNewsFromFeeds } from "./news";

export type ApiBindingMode = "builtin" | "http";

export interface ApiVariableBinding {
  id: string;
  order: number;
  enabled: boolean;
  /** Key trong template Telegram: {{gold}} */
  variableKey: string;
  /** Hiển thị trên UI cho người cấu hình */
  uiLabel: string;
  userNote: string;
  mode: ApiBindingMode;
  /** builtin: gold_usd, silver_usd, usd_vnd, eur_usd, gold_vnd, rss_headline */
  builtinKey?: string;
  /** http: URL JSON (GET) */
  httpUrl?: string;
  /** Dot path, vd: data.price hoặc 0.1 */
  httpPath?: string;
}

export interface ApiVariableRegistryFile {
  bindings: ApiVariableBinding[];
  updatedAt?: string;
}

const REGISTRY_PATH = path.join(process.cwd(), "data", "api-variable-registry.json");

export const BUILTIN_REGISTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "gold_usd", label: "Vàng spot (USD/oz) — metals.live" },
  { value: "silver_usd", label: "Bạc spot (USD/oz)" },
  { value: "usd_vnd", label: "USD/VND — Frankfurter" },
  { value: "eur_usd", label: "EUR/USD" },
  { value: "gold_vnd", label: "Vàng × USD/VND (ước VND/oz)" },
  { value: "rss_headline", label: "Tiêu đề tin RSS đầu tiên" },
];

const DEFAULT_BINDINGS: ApiVariableBinding[] = [
  {
    id: "def-gold",
    order: 0,
    enabled: true,
    variableKey: "gold",
    uiLabel: "Vàng TG",
    userNote: "Giá vàng quốc tế USD/oz",
    mode: "builtin",
    builtinKey: "gold_usd",
  },
  {
    id: "def-silver",
    order: 1,
    enabled: true,
    variableKey: "silver",
    uiLabel: "Bạc TG",
    userNote: "Giá bạc USD/oz",
    mode: "builtin",
    builtinKey: "silver_usd",
  },
  {
    id: "def-usd",
    order: 2,
    enabled: true,
    variableKey: "usdVnd",
    uiLabel: "USD/VND",
    userNote: "",
    mode: "builtin",
    builtinKey: "usd_vnd",
  },
];

function ensureDataDir(): void {
  const dir = path.dirname(REGISTRY_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readApiVariableRegistry(): ApiVariableRegistryFile {
  try {
    if (!existsSync(REGISTRY_PATH)) return { bindings: structuredClone(DEFAULT_BINDINGS) };
    const p = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")) as ApiVariableRegistryFile;
    if (!p.bindings?.length) return { bindings: structuredClone(DEFAULT_BINDINGS) };
    const sorted = [...p.bindings].sort((a, b) => a.order - b.order);
    return { ...p, bindings: sorted };
  } catch {
    return { bindings: structuredClone(DEFAULT_BINDINGS) };
  }
}

export function writeApiVariableRegistry(data: ApiVariableRegistryFile): void {
  ensureDataDir();
  writeFileSync(
    REGISTRY_PATH,
    JSON.stringify(
      {
        ...data,
        bindings: data.bindings.map((b, i) => ({ ...b, order: i })),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf-8",
  );
}

export function normalizeVariableKey(raw: string): string {
  return raw.replace(/^\{\{?/, "").replace(/\}\}?$/, "").replace(/[{}]/g, "").trim();
}

function getAtPath(obj: unknown, pathStr: string): unknown {
  if (!pathStr.trim()) return obj;
  const parts = pathStr.split(".").map((s) => s.trim());
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    const n = Number(part);
    if (!Number.isNaN(n) && Array.isArray(cur)) {
      cur = cur[n];
    } else if (typeof cur === "object" && cur !== null && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v).slice(0, 2000);
  } catch {
    return "—";
  }
}

export async function resolveBuiltinBindingValue(builtinKey: string): Promise<string> {
  switch (builtinKey) {
    case "gold_usd": {
      const metals = await fetchMetalSpots();
      const g = metals.find((m) => m.key === "gold")?.priceUsd;
      return g != null ? g.toFixed(2) : "—";
    }
    case "silver_usd": {
      const metals = await fetchMetalSpots();
      const s = metals.find((m) => m.key === "silver")?.priceUsd;
      return s != null ? s.toFixed(2) : "—";
    }
    case "usd_vnd": {
      const forex = await fetchForex();
      const v = vndPerUsd(forex);
      return v ? v.toLocaleString("vi-VN") : "—";
    }
    case "eur_usd": {
      const forex = await fetchForex();
      const e = forex.rates.find((r) => r.code === "EUR");
      return e ? e.rate.toFixed(4) : "—";
    }
    case "gold_vnd": {
      const [metals, forex] = await Promise.all([fetchMetalSpots(), fetchForex()]);
      const g = metals.find((m) => m.key === "gold")?.priceUsd;
      const v = vndPerUsd(forex);
      if (g != null && v) return (g * v).toLocaleString("vi-VN");
      return "—";
    }
    case "rss_headline": {
      const news = await fetchNewsFromFeeds(undefined, 1);
      return news[0]?.title ?? "—";
    }
    default:
      return "—";
  }
}

export async function resolveHttpBindingValue(url: string, pathStr: string): Promise<string> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    throw new Error("URL phải bắt đầu http:// hoặc https://");
  }
  const res = await fetch(u, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  let data: unknown;
  if (ct.includes("application/json") || u.endsWith(".json")) {
    data = (await res.json()) as unknown;
  } else {
    const t = await res.text();
    try {
      data = JSON.parse(t) as unknown;
    } catch {
      return t.slice(0, 4000);
    }
  }
  const at = getAtPath(data, pathStr.trim());
  return stringifyValue(at ?? data);
}

export async function resolveBindingValue(binding: ApiVariableBinding): Promise<string> {
  if (!binding.enabled) return "—";
  if (binding.mode === "http") {
    return resolveHttpBindingValue(binding.httpUrl ?? "", binding.httpPath ?? "");
  }
  return resolveBuiltinBindingValue(binding.builtinKey ?? "gold_usd");
}

/** Map {{variableKey}} → value (registry ghi đè nếu trùng key) */
export async function buildRegistryTemplateVars(): Promise<Record<string, string>> {
  const { bindings } = readApiVariableRegistry();
  const vars: Record<string, string> = {};
  for (const b of bindings) {
    const k = normalizeVariableKey(b.variableKey);
    if (!k) continue;
    try {
      vars[`{{${k}}}`] = await resolveBindingValue(b);
    } catch {
      vars[`{{${k}}}`] = "—";
    }
  }
  return vars;
}

export interface TestBindingResult {
  ok: boolean;
  value?: string;
  error?: string;
  extras?: Record<string, string>;
}

export async function testBinding(binding: ApiVariableBinding): Promise<TestBindingResult> {
  try {
    const value = await resolveBindingValue(binding);
    const extras: Record<string, string> = { value };
    if (binding.mode === "builtin" && binding.builtinKey === "rss_headline") {
      const news = await fetchNewsFromFeeds(undefined, 3);
      news.forEach((n, i) => {
        extras[`headline_${i + 1}`] = n.title;
      });
    }
    return { ok: true, value, extras };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lỗi" };
  }
}
