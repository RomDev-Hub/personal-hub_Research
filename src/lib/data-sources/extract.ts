import {
  resolveBuiltinBindingValue,
  resolveHttpBindingValue,
} from "@/lib/api-variable-registry";
import type { DataSourceGroup, Keypoint } from "./types";

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
    return JSON.stringify(v).slice(0, 4000);
  } catch {
    return "—";
  }
}

async function fetchJsonFromUrl(url: string, timeoutMs = 12_000): Promise<unknown> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    throw new Error("URL phải bắt đầu http:// hoặc https://");
  }
  const res = await fetch(u, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json") || u.endsWith(".json")) {
    return (await res.json()) as unknown;
  }
  const t = await res.text();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return t;
  }
}

/** Cache JSON theo nhóm trong một lần resolve/test (tránh gọi HTTP lặp). */
const groupJsonCache = new Map<string, { url: string; data: unknown; at: number }>();

async function getGroupJson(group: DataSourceGroup): Promise<unknown> {
  if (group.kind !== "http_json") throw new Error("Nhóm không phải http_json");
  const shared = group.shared as { baseUrl: string; timeoutMs?: number };
  const url = shared.baseUrl?.trim() ?? "";
  const cached = groupJsonCache.get(group.id);
  if (cached && cached.url === url && Date.now() - cached.at < 5_000) return cached.data;
  const data = await fetchJsonFromUrl(url, shared.timeoutMs ?? 12_000);
  groupJsonCache.set(group.id, { url, data, at: Date.now() });
  return data;
}

export function clearGroupJsonCache(groupId?: string): void {
  if (groupId) groupJsonCache.delete(groupId);
  else groupJsonCache.clear();
}

export async function extractKeypointRaw(
  group: DataSourceGroup,
  keypoint: Keypoint,
): Promise<string> {
  if (!group.enabled || !keypoint.enabled) return "—";

  switch (group.kind) {
    case "static": {
      const v = (group.shared as { value?: string }).value ?? "";
      return v.trim() || "—";
    }
    case "builtin_hub": {
      const field = keypoint.extract.fieldKey?.trim() || "gold_usd";
      return resolveBuiltinBindingValue(field);
    }
    case "http_json": {
      const path = keypoint.extract.jsonPath?.trim() ?? "";
      const shared = group.shared as { baseUrl: string };
      if (!shared.baseUrl?.trim()) throw new Error("Chưa có URL nhóm");
      if (path) {
        const data = await getGroupJson(group);
        return stringifyValue(getAtPath(data, path));
      }
      return resolveHttpBindingValue(shared.baseUrl, "");
    }
    default:
      return "—";
  }
}
