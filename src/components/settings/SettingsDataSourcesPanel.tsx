"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { SettingsAdvancedLab } from "./SettingsAdvancedLab";
import { SettingsPageShell } from "./SettingsPageShell";
import { SettingsSecretFields } from "./SettingsSecretFields";
import { rawKeyFromSlug, normalizeKeySlug } from "@/lib/data-sources/keys";
import type {
  DataSourceGroup,
  DataSourceKind,
  DataSourcesFile,
  HttpJsonShared,
  Keypoint,
  KeypointTestResult,
} from "@/lib/data-sources/types";

type BuiltinOpt = { value: string; label: string };
type PresetMeta = { id: string; name: string; description: string; kind: DataSourceKind };
type Dup = { key: string; locations: string[] };

function newGroupId() {
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function newKpId() {
  return `kp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function newOutId() {
  return `out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyGroup(order: number): DataSourceGroup {
  return {
    id: newGroupId(),
    order,
    enabled: true,
    name: `Nguồn ${order + 1}`,
    description: "",
    kind: "builtin_hub",
    shared: { connectorLabel: "" },
    keypoints: [],
  };
}

function emptyKeypoint(order: number): Keypoint {
  const slug = `var_${order + 1}`;
  return {
    id: newKpId(),
    order,
    enabled: true,
    label: "",
    note: "",
    keySlug: slug,
    extract: { fieldKey: "gold_usd" },
    outputs: [
      {
        id: newOutId(),
        order: 0,
        enabled: true,
        outputKey: slug,
        mode: "passthrough",
      },
    ],
  };
}

const KIND_LABELS: Record<DataSourceKind, string> = {
  builtin_hub: "Built-in hub",
  http_json: "HTTP JSON",
  static: "Giá trị tĩnh",
};

function keypointSummary(kp: Keypoint): string {
  const raw = rawKeyFromSlug(kp.keySlug);
  const outs = kp.outputs.filter((o) => o.enabled).map((o) => o.outputKey).join(", ");
  return `${raw} → ${outs || "—"}`;
}

interface SettingsDataSourcesPanelProps {
  onBack: () => void;
}

export function SettingsDataSourcesPanel({ onBack }: SettingsDataSourcesPanelProps) {
  const [groups, setGroups] = useState<DataSourceGroup[]>([]);
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [builtinOpts, setBuiltinOpts] = useState<BuiltinOpt[]>([]);
  const [dupes, setDupes] = useState<Dup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openKeypoints, setOpenKeypoints] = useState<Set<string>>(new Set());
  const [openAdvanced, setOpenAdvanced] = useState<Set<string>>(new Set());
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const [testModal, setTestModal] = useState<{
    title: string;
    result: KeypointTestResult;
  } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hub/data-sources", { cache: "no-store" });
      const json = (await res.json()) as DataSourcesFile & {
        presets?: PresetMeta[];
        builtinFieldOptions?: BuiltinOpt[];
        duplicateKeys?: Dup[];
      };
      setGroups(json.groups ?? []);
      setPresets(json.presets ?? []);
      setBuiltinOpts(json.builtinFieldOptions ?? []);
      setDupes(json.duplicateKeys ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchGroup(id: string, patch: Partial<DataSourceGroup>) {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function patchKeypoint(groupId: string, kpId: string, patch: Partial<Keypoint>) {
    setGroups((list) =>
      list.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          keypoints: g.keypoints.map((k) => {
            if (k.id !== kpId) return k;
            const next = { ...k, ...patch };
            if (patch.keySlug !== undefined) {
              const slug = normalizeKeySlug(patch.keySlug);
              next.keySlug = slug;
            }
            return next;
          }),
        };
      }),
    );
  }

  function moveGroup(fromId: string, toId: string) {
    if (fromId === toId) return;
    setGroups((list) => {
      const i = list.findIndex((g) => g.id === fromId);
      const j = list.findIndex((g) => g.id === toId);
      if (i < 0 || j < 0) return list;
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next.map((g, order) => ({ ...g, order }));
    });
  }

  async function saveAll() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/hub/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", file: { groups } }),
      });
      const json = (await res.json()) as { error?: string; groups?: DataSourceGroup[] };
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại");
      if (json.groups) setGroups(json.groups);
      setFeedback("Đã lưu nguồn dữ liệu.");
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function runTest(group: DataSourceGroup, kp: Keypoint) {
    setTesting(kp.id);
    try {
      const res = await fetch("/api/hub/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_keypoint", group, keypoint: kp }),
      });
      const json = (await res.json()) as KeypointTestResult;
      setTestModal({
        title: `${group.name} · ${kp.label || kp.keySlug}`,
        result: json,
      });
    } finally {
      setTesting(null);
    }
  }

  async function addPreset(presetId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/hub/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_preset", presetId }),
      });
      const json = (await res.json()) as { groups?: DataSourceGroup[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Thất bại");
      if (json.groups) setGroups(json.groups);
      setFeedback("Đã thêm nhóm từ mẫu.");
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function importRegistry() {
    if (!confirm("Thêm nhóm mới từ api-variable-registry.json (không xóa file cũ)?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hub/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_registry" }),
      });
      const json = (await res.json()) as { groups?: DataSourceGroup[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Thất bại");
      if (json.groups) setGroups(json.groups);
      setFeedback("Đã import registry cũ.");
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  const toggleAdv = (id: string) => {
    setOpenAdvanced((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <SettingsPageShell
      wide
      title="NGUỒN"
      titleAccent="DỮ LIỆU"
      subtitle="Nhóm = một nguồn. Mỗi điểm có key thô tự động *_raw và một hoặc nhiều key sau xử lý. Telegram/UI sau này chỉ chọn key."
      onBack={onBack}
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={load} disabled={loading} className="btn-secondary text-[11px]">
          <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </button>
        <button
          type="button"
          onClick={() => {
            const g = emptyGroup(groups.length);
            setGroups((x) => [...x, g]);
            setOpenGroups((s) => new Set(s).add(g.id));
          }}
          className="btn-secondary text-[11px]"
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" />
          Thêm nhóm
        </button>
        <button type="button" disabled={saving} onClick={saveAll} className="btn-primary text-[11px]">
          <Save className="mr-1 inline h-3.5 w-3.5" />
          Lưu
        </button>
      </div>

      {dupes.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-3 text-[10px] text-red-300">
          <p className="font-semibold">Key trùng — sửa trước khi lưu:</p>
          <ul className="mt-1 list-inside list-disc">
            {dupes.map((d) => (
              <li key={d.key}>
                <code>{d.key}</code>: {d.locations.join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="settings-kv-card p-3 sm:p-4">
        <p className="text-[10px] font-semibold text-[var(--foreground)]">Mẫu & import</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={saving}
              onClick={() => addPreset(p.id)}
              className="tab-pill max-w-[14rem] truncate text-[10px]"
              title={p.description}
            >
              + {p.name}
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={importRegistry}
            className="tab-pill text-[10px]"
          >
            + Registry cũ
          </button>
        </div>
      </section>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">Đang tải…</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const expanded = openGroups.has(group.id);
            return (
              <article
                key={group.id}
                draggable
                onDragStart={() => setDragGroupId(group.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragGroupId) moveGroup(dragGroupId, group.id);
                  setDragGroupId(null);
                }}
                onDragEnd={() => setDragGroupId(null)}
                className={`rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 ${
                  dragGroupId === group.id ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-stretch gap-0">
                  <span className="flex cursor-grab items-center px-2 text-[var(--muted)]">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <label className="flex items-center px-2">
                    <input
                      type="checkbox"
                      checked={group.enabled}
                      onChange={(e) => patchGroup(group.id, { enabled: e.target.checked })}
                    />
                  </label>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-2 text-left sm:flex-row sm:items-center sm:gap-3"
                    onClick={() =>
                      setOpenGroups((s) => {
                        const n = new Set(s);
                        if (n.has(group.id)) n.delete(group.id);
                        else n.add(group.id);
                        return n;
                      })
                    }
                  >
                    <span className="truncate text-[11px] font-semibold">{group.name}</span>
                    <span className="shrink-0 rounded bg-black/30 px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                      {KIND_LABELS[group.kind]}
                    </span>
                    <span className="truncate text-[10px] text-[var(--muted)]">
                      {group.keypoints.length} điểm
                    </span>
                  </button>
                  <button
                    type="button"
                    className="px-2 text-[var(--muted)]"
                    onClick={() =>
                      setOpenGroups((s) => {
                        const n = new Set(s);
                        if (n.has(group.id)) n.delete(group.id);
                        else n.add(group.id);
                        return n;
                      })
                    }
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                {expanded && (
                  <div className="space-y-3 border-t border-[var(--border)]/60 px-3 pb-3 pt-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-[10px] text-[var(--muted)]">
                        Tên nhóm
                        <input
                          value={group.name}
                          onChange={(e) => patchGroup(group.id, { name: e.target.value })}
                          className="input mt-0.5 w-full text-[11px]"
                        />
                      </label>
                      <label className="text-[10px] text-[var(--muted)]">
                        Phương thức
                        <select
                          value={group.kind}
                          onChange={(e) => {
                            const kind = e.target.value as DataSourceKind;
                            let shared = group.shared;
                            if (kind === "http_json") shared = { baseUrl: "", method: "GET" };
                            if (kind === "builtin_hub") shared = { connectorLabel: "" };
                            if (kind === "static") shared = { value: "" };
                            patchGroup(group.id, { kind, shared });
                          }}
                          className="input mt-0.5 w-full text-[11px]"
                        >
                          {(Object.keys(KIND_LABELS) as DataSourceKind[]).map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="text-[10px] text-[var(--accent)]"
                      onClick={() => toggleAdv(`g-${group.id}`)}
                    >
                      {openAdvanced.has(`g-${group.id}`) ? "▼" : "▶"} Cấu hình chung nguồn
                    </button>
                    {openAdvanced.has(`g-${group.id}`) && (
                      <div className="rounded-lg bg-black/20 p-2">
                        {group.kind === "http_json" && (
                          <label className="block text-[10px] text-[var(--muted)]">
                            URL (GET JSON)
                            <input
                              value={(group.shared as HttpJsonShared).baseUrl ?? ""}
                              onChange={(e) =>
                                patchGroup(group.id, {
                                  shared: { ...(group.shared as HttpJsonShared), baseUrl: e.target.value },
                                })
                              }
                              className="input mt-0.5 w-full font-mono text-[10px]"
                            />
                          </label>
                        )}
                        {group.kind === "static" && (
                          <label className="block text-[10px] text-[var(--muted)]">
                            Giá trị tĩnh
                            <input
                              value={(group.shared as { value?: string }).value ?? ""}
                              onChange={(e) =>
                                patchGroup(group.id, { shared: { value: e.target.value } })
                              }
                              className="input mt-0.5 w-full text-[11px]"
                            />
                          </label>
                        )}
                        {group.kind === "builtin_hub" && (
                          <p className="text-[10px] text-[var(--muted)]">
                            Mỗi điểm chọn field built-in (metals, forex, RSS…).
                          </p>
                        )}
                        <label className="mt-2 block text-[10px] text-[var(--muted)]">
                          Mô tả
                          <input
                            value={group.description}
                            onChange={(e) => patchGroup(group.id, { description: e.target.value })}
                            className="input mt-0.5 w-full text-[11px]"
                          />
                        </label>
                      </div>
                    )}

                    <div className="space-y-2">
                      {group.keypoints.map((kp) => {
                        const kpOpen = openKeypoints.has(kp.id);
                        const rawK = rawKeyFromSlug(kp.keySlug);
                        return (
                          <div
                            key={kp.id}
                            className="rounded-lg border border-[var(--border)]/60 bg-black/15"
                          >
                            <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={kp.enabled}
                                onChange={(e) =>
                                  patchKeypoint(group.id, kp.id, { enabled: e.target.checked })
                                }
                              />
                              <button
                                type="button"
                                className="min-w-0 flex-1 truncate text-left text-[10px]"
                                onClick={() =>
                                  setOpenKeypoints((s) => {
                                    const n = new Set(s);
                                    if (n.has(kp.id)) n.delete(kp.id);
                                    else n.add(kp.id);
                                    return n;
                                  })
                                }
                              >
                                <span className="font-medium">{kp.label || kp.keySlug || "Điểm"}</span>
                                <span className="ml-2 font-mono text-[var(--muted)]">
                                  {keypointSummary(kp)}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={testing === kp.id}
                                onClick={() => runTest(group, kp)}
                                className="btn-secondary shrink-0 px-2 py-1 text-[9px]"
                              >
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  patchGroup(group.id, {
                                    keypoints: group.keypoints.filter((k) => k.id !== kp.id),
                                  })
                                }
                                className="text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {kpOpen && (
                              <div className="space-y-2 border-t border-[var(--border)]/40 px-2 pb-2 pt-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="text-[10px] text-[var(--muted)]">
                                    Nhãn
                                    <input
                                      value={kp.label}
                                      onChange={(e) =>
                                        patchKeypoint(group.id, kp.id, { label: e.target.value })
                                      }
                                      className="input mt-0.5 w-full text-[11px]"
                                    />
                                  </label>
                                  <label className="text-[10px] text-[var(--muted)]">
                                    Slug key (→ <code className="text-[var(--accent)]">{rawK || "…"}</code>)
                                    <input
                                      value={kp.keySlug}
                                      onChange={(e) =>
                                        patchKeypoint(group.id, kp.id, { keySlug: e.target.value })
                                      }
                                      className="input mt-0.5 w-full font-mono text-[11px]"
                                      placeholder="gold"
                                    />
                                  </label>
                                </div>
                                {group.kind === "builtin_hub" && (
                                  <label className="text-[10px] text-[var(--muted)]">
                                    Field built-in
                                    <select
                                      value={kp.extract.fieldKey ?? "gold_usd"}
                                      onChange={(e) =>
                                        patchKeypoint(group.id, kp.id, {
                                          extract: { ...kp.extract, fieldKey: e.target.value },
                                        })
                                      }
                                      className="input mt-0.5 w-full text-[11px]"
                                    >
                                      {builtinOpts.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                {group.kind === "http_json" && (
                                  <label className="text-[10px] text-[var(--muted)]">
                                    JSON path (dot)
                                    <input
                                      value={kp.extract.jsonPath ?? ""}
                                      onChange={(e) =>
                                        patchKeypoint(group.id, kp.id, {
                                          extract: { ...kp.extract, jsonPath: e.target.value },
                                        })
                                      }
                                      className="input mt-0.5 w-full font-mono text-[10px]"
                                      placeholder="gold hoặc 0.price"
                                    />
                                  </label>
                                )}
                                <label className="text-[10px] text-[var(--muted)]">
                                  Chú thích
                                  <input
                                    value={kp.note}
                                    onChange={(e) =>
                                      patchKeypoint(group.id, kp.id, { note: e.target.value })
                                    }
                                    className="input mt-0.5 w-full text-[11px]"
                                  />
                                </label>

                                <div className="space-y-1">
                                  <p className="text-[9px] uppercase text-[var(--muted)]">Key sau xử lý</p>
                                  {kp.outputs.map((o) => (
                                    <div
                                      key={o.id}
                                      className="flex flex-wrap items-end gap-2 rounded bg-black/20 p-1.5"
                                    >
                                      <label className="min-w-[6rem] flex-1 text-[10px] text-[var(--muted)]">
                                        Key
                                        <input
                                          value={o.outputKey}
                                          onChange={(e) =>
                                            patchKeypoint(group.id, kp.id, {
                                              outputs: kp.outputs.map((x) =>
                                                x.id === o.id ? { ...x, outputKey: e.target.value } : x,
                                              ),
                                            })
                                          }
                                          className="input mt-0.5 w-full font-mono text-[10px]"
                                        />
                                      </label>
                                      <label className="text-[10px] text-[var(--muted)]">
                                        Xử lý
                                        <select
                                          value={o.mode}
                                          disabled
                                          className="input mt-0.5 text-[10px]"
                                          title="P1: formula, boolean, …"
                                        >
                                          <option value="passthrough">Không đổi</option>
                                        </select>
                                      </label>
                                      <button
                                        type="button"
                                        className="text-red-400"
                                        disabled={kp.outputs.length <= 1}
                                        onClick={() =>
                                          patchKeypoint(group.id, kp.id, {
                                            outputs: kp.outputs.filter((x) => x.id !== o.id),
                                          })
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className="text-[10px] text-[var(--accent)]"
                                    onClick={() =>
                                      patchKeypoint(group.id, kp.id, {
                                        outputs: [
                                          ...kp.outputs,
                                          {
                                            id: newOutId(),
                                            order: kp.outputs.length,
                                            enabled: true,
                                            outputKey: `${normalizeKeySlug(kp.keySlug)}_2`,
                                            mode: "passthrough",
                                          },
                                        ],
                                      })
                                    }
                                  >
                                    + Thêm output
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn-secondary text-[10px]"
                      onClick={() => {
                        const kp = emptyKeypoint(group.keypoints.length);
                        patchGroup(group.id, { keypoints: [...group.keypoints, kp] });
                        setOpenKeypoints((s) => new Set(s).add(kp.id));
                      }}
                    >
                      <Plus className="mr-1 inline h-3 w-3" />
                      Thêm điểm
                    </button>
                    <button
                      type="button"
                      className="ml-2 text-[10px] text-red-400"
                      onClick={() => {
                        if (confirm("Xóa nhóm này?")) {
                          setGroups((g) => g.filter((x) => x.id !== group.id));
                        }
                      }}
                    >
                      Xóa nhóm
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <SettingsSecretFields section="api" title="Bảo mật API hub (tùy chọn)" />
      <SettingsAdvancedLab />

      {feedback && (
        <p
          className={`text-[11px] ${feedback.startsWith("Đã") ? "text-emerald-400" : "text-amber-400"}`}
        >
          {feedback}
        </p>
      )}

      {testModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Đóng"
            onClick={() => setTestModal(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
              <p className="truncate text-sm font-semibold">{testModal.title}</p>
              <button type="button" onClick={() => setTestModal(null)} className="btn-secondary p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4 text-[11px]">
              {testModal.result.ok ? (
                <>
                  <p>
                    <span className="text-[var(--muted)]">Raw </span>
                    <code className="text-[var(--accent)]">{testModal.result.rawKey}</code>
                    <span className="text-[var(--muted)]"> ({testModal.result.timingMs}ms)</span>
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-black/30 p-2 font-mono">
                    {testModal.result.raw}
                  </pre>
                  {testModal.result.outputs && Object.keys(testModal.result.outputs).length > 0 && (
                    <>
                      <p className="mt-3 font-semibold">Sau xử lý</p>
                      <ul className="mt-1 space-y-1">
                        {Object.entries(testModal.result.outputs).map(([k, v]) => (
                          <li key={k}>
                            <code className="text-[var(--accent)]">{k}</code>: {v}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p className="text-red-400">{testModal.result.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsPageShell>
  );
}
