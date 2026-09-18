import { extractKeypointRaw, clearGroupJsonCache } from "./extract";
import { rawKeyFromSlug } from "./keys";
import type {
  DataSourceGroup,
  DataSourcesFile,
  DuplicateKeyError,
  Keypoint,
  KeypointTestResult,
  ProcessedOutput,
} from "./types";

function applyPassthrough(raw: string, _output: ProcessedOutput): string {
  return raw;
}

export function collectPublishedKeys(
  file: DataSourcesFile,
  onlyEnabled = true,
): { key: string; location: string }[] {
  const out: { key: string; location: string }[] = [];
  for (const g of file.groups) {
    if (onlyEnabled && !g.enabled) continue;
    for (const kp of g.keypoints) {
      if (onlyEnabled && !kp.enabled) continue;
      const slug = kp.keySlug.trim();
      if (!slug) continue;
      const rk = rawKeyFromSlug(slug);
      if (rk) out.push({ key: rk, location: `${g.name} · ${kp.label || slug} (raw)` });
      for (const o of kp.outputs) {
        if (onlyEnabled && !o.enabled) continue;
        const k = o.outputKey.trim();
        if (k) out.push({ key: k, location: `${g.name} · ${kp.label || slug} → ${k}` });
      }
    }
  }
  return out;
}

export function findDuplicateKeys(file: DataSourcesFile): DuplicateKeyError[] {
  const map = new Map<string, string[]>();
  for (const { key, location } of collectPublishedKeys(file, false)) {
    const list = map.get(key) ?? [];
    list.push(location);
    map.set(key, list);
  }
  const dupes: DuplicateKeyError[] = [];
  for (const [key, locations] of map) {
    if (locations.length > 1) dupes.push({ key, locations });
  }
  return dupes;
}

export async function resolveKeypoint(
  group: DataSourceGroup,
  keypoint: Keypoint,
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  const raw = await extractKeypointRaw(group, keypoint);
  const rk = rawKeyFromSlug(keypoint.keySlug);
  if (rk) vars[rk] = raw;

  const sorted = [...keypoint.outputs].sort((a, b) => a.order - b.order);
  for (const o of sorted) {
    if (!o.enabled) continue;
    const k = o.outputKey.trim();
    if (!k) continue;
    if (o.mode === "passthrough") vars[k] = applyPassthrough(raw, o);
  }
  return vars;
}

export async function testKeypoint(
  group: DataSourceGroup,
  keypoint: Keypoint,
): Promise<KeypointTestResult> {
  const t0 = Date.now();
  const rawKey = rawKeyFromSlug(keypoint.keySlug);
  try {
    clearGroupJsonCache(group.id);
    const vars = await resolveKeypoint(group, keypoint);
    const outputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      if (k !== rawKey) outputs[k] = v;
    }
    return {
      ok: true,
      rawKey,
      raw: vars[rawKey],
      outputs,
      timingMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      rawKey,
      error: e instanceof Error ? e.message : "Lỗi",
      timingMs: Date.now() - t0,
    };
  }
}

export async function resolveAllDataSourceKeys(
  file: DataSourcesFile,
): Promise<Record<string, string>> {
  const merged: Record<string, string> = {};
  const sortedGroups = [...file.groups].sort((a, b) => a.order - b.order);
  for (const g of sortedGroups) {
    if (!g.enabled) continue;
    clearGroupJsonCache(g.id);
    const sortedKp = [...g.keypoints].sort((a, b) => a.order - b.order);
    for (const kp of sortedKp) {
      if (!kp.enabled) continue;
      try {
        const part = await resolveKeypoint(g, kp);
        Object.assign(merged, part);
      } catch {
        const rk = rawKeyFromSlug(kp.keySlug);
        if (rk) merged[rk] = "—";
      }
    }
  }
  clearGroupJsonCache();
  return merged;
}

/** Cho Telegram: map key → {{key}} */
import { readDataSourcesFile } from "./storage";

export async function buildDataSourceTemplateVars(): Promise<Record<string, string>> {
  const file = readDataSourcesFile();
  const keys = await resolveAllDataSourceKeys(file);
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) {
    vars[`{{${k}}}`] = v;
  }
  return vars;
}
