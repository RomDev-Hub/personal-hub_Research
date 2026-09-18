import type { ProcessedOutput } from "./types";

const SLUG_RE = /^[a-z][a-z0-9_]*$/i;

export function normalizeKeySlug(input: string): string {
  let s = input
    .trim()
    .replace(/^\{\{?/, "")
    .replace(/\}\}?$/, "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (s.endsWith("_raw")) s = s.slice(0, -4);
  if (!s) return "";
  if (!/^[a-z]/i.test(s)) s = `k_${s}`;
  return s.toLowerCase();
}

export function rawKeyFromSlug(slug: string): string {
  const s = normalizeKeySlug(slug);
  return s ? `${s}_raw` : "";
}

export function isValidSlug(slug: string): boolean {
  const s = normalizeKeySlug(slug);
  return Boolean(s && SLUG_RE.test(s));
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultPassthroughOutput(slug: string, order = 0): ProcessedOutput {
  const s = normalizeKeySlug(slug);
  return {
    id: newId("out"),
    order,
    enabled: true,
    outputKey: s,
    mode: "passthrough",
  };
}
