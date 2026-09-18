import { BUILTIN_REGISTRY_OPTIONS } from "@/lib/api-variable-registry";
import { defaultPassthroughOutput, newId } from "./keys";
import type { DataSourceGroup, Keypoint } from "./types";

export { BUILTIN_REGISTRY_OPTIONS as BUILTIN_FIELD_OPTIONS };

function kp(
  slug: string,
  label: string,
  fieldKey: string,
  note: string,
  order: number,
): Keypoint {
  const s = slug.replace(/_raw$/, "");
  return {
    id: newId("kp"),
    order,
    enabled: true,
    label,
    note,
    keySlug: s,
    extract: { fieldKey },
    outputs: [defaultPassthroughOutput(s, 0)],
  };
}

export const BUNDLED_PRESETS: DataSourceGroup[] = [
  {
    id: "preset-hub-market",
    order: 0,
    enabled: true,
    name: "Hub — Giá & tỷ giá",
    description: "Built-in metals.live, Frankfurter (mẫu mặc định app)",
    kind: "builtin_hub",
    shared: { connectorLabel: "Personal Hub connectors" },
    presetId: "preset-hub-market",
    keypoints: [
      kp("gold", "Vàng spot USD/oz", "gold_usd", "metals.live", 0),
      kp("silver", "Bạc spot USD/oz", "silver_usd", "metals.live", 1),
      kp("usdVnd", "USD/VND", "usd_vnd", "Frankfurter", 2),
    ],
  },
  {
    id: "preset-metals-http",
    order: 1,
    enabled: false,
    name: "Metals.live (HTTP JSON)",
    description: "Một URL — nhiều keypoint path (mẫu)",
    kind: "http_json",
    shared: {
      baseUrl: "https://api.metals.live/v1/spot",
      method: "GET",
    },
    presetId: "preset-metals-http",
    keypoints: [
      {
        id: newId("kp"),
        order: 0,
        enabled: true,
        label: "Vàng (path gold)",
        note: "Điều chỉnh jsonPath theo response thực tế",
        keySlug: "gold",
        extract: { jsonPath: "gold" },
        outputs: [defaultPassthroughOutput("gold", 0)],
      },
    ],
  },
];

export function getPresetById(presetId: string): DataSourceGroup | undefined {
  const p = BUNDLED_PRESETS.find((x) => x.presetId === presetId || x.id === presetId);
  if (!p) return undefined;
  return structuredClone({
    ...p,
    id: newId("grp"),
    presetId: p.presetId ?? p.id,
    keypoints: p.keypoints.map((k) => ({
      ...k,
      id: newId("kp"),
      outputs: k.outputs.map((o) => ({ ...o, id: newId("out") })),
    })),
  });
}
