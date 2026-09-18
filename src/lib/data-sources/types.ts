export type DataSourceKind = "http_json" | "builtin_hub" | "static";

/** P0: passthrough only; mở rộng formula | boolean | ... sau */
export type ProcessedMode = "passthrough";

export interface ProcessedOutput {
  id: string;
  order: number;
  enabled: boolean;
  outputKey: string;
  mode: ProcessedMode;
  config?: Record<string, unknown>;
}

export interface KeypointExtract {
  /** builtin_hub: gold_usd, usd_vnd, ... */
  fieldKey?: string;
  /** http_json: dot path trong JSON response */
  jsonPath?: string;
}

export interface Keypoint {
  id: string;
  order: number;
  enabled: boolean;
  label: string;
  note: string;
  keySlug: string;
  extract: KeypointExtract;
  outputs: ProcessedOutput[];
}

export interface HttpJsonShared {
  baseUrl: string;
  method?: "GET";
  timeoutMs?: number;
}

export interface BuiltinHubShared {
  /** Gợi ý nhóm; keypoint vẫn có fieldKey riêng */
  connectorLabel?: string;
}

export interface StaticShared {
  value: string;
}

export type DataSourceShared = HttpJsonShared | BuiltinHubShared | StaticShared;

export interface DataSourceGroup {
  id: string;
  order: number;
  enabled: boolean;
  name: string;
  description: string;
  kind: DataSourceKind;
  shared: DataSourceShared;
  keypoints: Keypoint[];
  presetId?: string;
}

export interface DataSourcesFile {
  groups: DataSourceGroup[];
  updatedAt?: string;
}

export interface KeypointTestResult {
  ok: boolean;
  rawKey: string;
  raw?: string;
  outputs?: Record<string, string>;
  error?: string;
  timingMs?: number;
}

export interface DuplicateKeyError {
  key: string;
  locations: string[];
}
