import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { findDuplicateKeys } from "./resolve";
import { BUNDLED_PRESETS } from "./presets";
import type { DataSourceGroup, DataSourcesFile, Keypoint } from "./types";
import { defaultPassthroughOutput, newId, normalizeKeySlug } from "./keys";

const DATA_SOURCES_PATH = path.join(process.cwd(), "data", "data-sources.json");

function ensureDataDir(): void {
  const dir = path.dirname(DATA_SOURCES_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function hydrateKeypoint(kp: Keypoint, index: number): Keypoint {
  const slug = normalizeKeySlug(kp.keySlug) || `point_${index}`;
  const outputs =
    kp.outputs?.length > 0
      ? kp.outputs.map((o, i) => ({
          ...o,
          order: o.order ?? i,
          mode: o.mode ?? "passthrough",
        }))
      : [defaultPassthroughOutput(slug, 0)];
  return {
    ...kp,
    order: kp.order ?? index,
    keySlug: slug,
    outputs,
  };
}

function hydrateGroup(g: DataSourceGroup, index: number): DataSourceGroup {
  return {
    ...g,
    order: g.order ?? index,
    keypoints: (g.keypoints ?? []).map((k, i) => hydrateKeypoint(k, i)),
  };
}

function seedDefaultFile(): DataSourcesFile {
  return {
    groups: BUNDLED_PRESETS.map((g, i) => hydrateGroup({ ...structuredClone(g), id: newId("grp") }, i)),
  };
}

export function readDataSourcesFile(): DataSourcesFile {
  try {
    if (!existsSync(DATA_SOURCES_PATH)) {
      return seedDefaultFile();
    }
    const parsed = JSON.parse(readFileSync(DATA_SOURCES_PATH, "utf-8")) as DataSourcesFile;
    if (!parsed.groups?.length) return seedDefaultFile();
    const groups = [...parsed.groups]
      .sort((a, b) => a.order - b.order)
      .map((g, i) => hydrateGroup(g, i));
    return { ...parsed, groups };
  } catch {
    return seedDefaultFile();
  }
}

export function writeDataSourcesFile(data: DataSourcesFile): void {
  const dupes = findDuplicateKeys(data);
  if (dupes.length) {
    const msg = dupes.map((d) => `${d.key}: ${d.locations.join("; ")}`).join("\n");
    throw new Error(`Key trùng:\n${msg}`);
  }
  ensureDataDir();
  const groups = data.groups.map((g, i) => ({
    ...g,
    order: i,
    keypoints: g.keypoints.map((k, j) => ({ ...k, order: j })),
  }));
  writeFileSync(
    DATA_SOURCES_PATH,
    JSON.stringify({ groups, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

export function getDataSourcesPersistPath(): string {
  return "data/data-sources.json";
}
