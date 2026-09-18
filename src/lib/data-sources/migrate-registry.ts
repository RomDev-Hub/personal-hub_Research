import { readApiVariableRegistry } from "@/lib/api-variable-registry";
import { defaultPassthroughOutput, newId, normalizeKeySlug } from "./keys";
import type { DataSourceGroup, Keypoint } from "./types";

/** Import registry cũ → một nhóm builtin (không xóa file cũ). */
export function groupsFromLegacyRegistry(): DataSourceGroup {
  const reg = readApiVariableRegistry();
  const keypoints: Keypoint[] = reg.bindings.map((b, i) => {
    const slug = normalizeKeySlug(b.variableKey) || `var_${i}`;
    const extract =
      b.mode === "http"
        ? { jsonPath: b.httpPath ?? "" }
        : { fieldKey: b.builtinKey ?? "gold_usd" };
    return {
      id: newId("kp"),
      order: i,
      enabled: b.enabled,
      label: b.uiLabel || slug,
      note: b.userNote || "",
      keySlug: slug,
      extract,
      outputs: [defaultPassthroughOutput(slug, 0)],
    };
  });

  const hasHttp = reg.bindings.some((b) => b.mode === "http");
  return {
    id: newId("grp"),
    order: 0,
    enabled: true,
    name: "Nhập từ registry cũ",
    description: hasHttp
      ? "Gồm builtin + HTTP từ api-variable-registry.json"
      : "Từ api-variable-registry.json",
    kind: hasHttp ? "http_json" : "builtin_hub",
    shared: hasHttp
      ? {
          baseUrl: reg.bindings.find((b) => b.httpUrl)?.httpUrl ?? "https://api.metals.live/v1/spot",
        }
      : { connectorLabel: "Legacy import" },
    keypoints,
    presetId: "import-registry",
  };
}
