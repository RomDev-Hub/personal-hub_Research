"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  GripVertical,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { SettingsAdvancedLab } from "./SettingsAdvancedLab";
import { SettingsPageShell } from "./SettingsPageShell";
import { SettingsSecretFields } from "./SettingsSecretFields";

type BuiltinOption = { value: string; label: string };

type ApiBindingClient = {
  id: string;
  order: number;
  enabled: boolean;
  variableKey: string;
  uiLabel: string;
  userNote: string;
  mode: "builtin" | "http";
  builtinKey?: string;
  httpUrl?: string;
  httpPath?: string;
};

interface SettingsApiPanelProps {
  onBack: () => void;
}

function newBindingId(): string {
  return `bind-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyBinding(order: number): ApiBindingClient {
  return {
    id: newBindingId(),
    order,
    enabled: true,
    variableKey: "",
    uiLabel: "",
    userNote: "",
    mode: "builtin",
    builtinKey: "gold_usd",
    httpUrl: "",
    httpPath: "",
  };
}

interface TestState {
  ok: boolean;
  value?: string;
  error?: string;
  extras?: Record<string, string>;
}

export function SettingsApiPanel({ onBack }: SettingsApiPanelProps) {
  const [bindings, setBindings] = useState<ApiBindingClient[]>([]);
  const [builtinOptions, setBuiltinOptions] = useState<BuiltinOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const [marketOk, setMarketOk] = useState<boolean | null>(null);
  const [marketMsg, setMarketMsg] = useState("");
  const [marketTesting, setMarketTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hub/api-variables", { cache: "no-store" });
      const json = (await res.json()) as {
        bindings?: ApiBindingClient[];
        builtinOptions?: BuiltinOption[];
      };
      setBindings(json.bindings ?? []);
      setBuiltinOptions(json.builtinOptions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchBinding(id: string, patch: Partial<ApiBindingClient>) {
    setBindings((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    setBindings((list) => {
      const i = list.findIndex((b) => b.id === fromId);
      const j = list.findIndex((b) => b.id === toId);
      if (i < 0 || j < 0) return list;
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next.map((b, order) => ({ ...b, order }));
    });
  }

  async function saveAll() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/hub/api-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", registry: { bindings } }),
      });
      const json = (await res.json()) as { error?: string; bindings?: ApiBindingClient[] };
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại");
      if (json.bindings) setBindings(json.bindings);
      setFeedback("Đã lưu registry biến — Telegram dùng {{key}} theo đây.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function runTest(b: ApiBindingClient) {
    setTestingId(b.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/hub/api-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_one", binding: b }),
      });
      const json = (await res.json()) as TestState;
      setTests((prev) => ({ ...prev, [b.id]: json }));
      if (!json.ok) setFeedback(json.error ?? "Test thất bại");
    } catch (e) {
      setTests((prev) => ({
        ...prev,
        [b.id]: { ok: false, error: e instanceof Error ? e.message : "Lỗi" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function testMarket() {
    setMarketTesting(true);
    setMarketOk(null);
    try {
      const res = await fetch("/api/market?live=1&chartRange=7d&record=0", { cache: "no-store" });
      const json = (await res.json()) as { error?: string; fetchedAt?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMarketOk(true);
      setMarketMsg(json.fetchedAt ? `OK · ${json.fetchedAt}` : "Kết nối API thị trường thành công");
    } catch (e) {
      setMarketOk(false);
      setMarketMsg(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setMarketTesting(false);
    }
  }

  function addBinding() {
    setBindings((list) => [...list, emptyBinding(list.length)]);
  }

  function removeBinding(id: string) {
    if (!confirm("Xóa dòng biến này khỏi registry?")) return;
    setBindings((list) => list.filter((b) => b.id !== id));
  }

  return (
    <SettingsPageShell
      wide
      title="CÀI ĐẶT"
      titleAccent="API"
      subtitle="Kéo thả sắp xếp, thêm nguồn tùy ý (built-in hub hoặc GET JSON). Tên khóa dùng trong template Telegram là {{variableKey}}."
      onBack={onBack}
    >
      <section className="settings-kv-card">
        <header className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h3 className="settings-kv-card-title !mb-0">
            BIẾN <span className="text-[var(--accent)]">DỮ LIỆU</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading || saving}
              className="btn-secondary flex items-center gap-2 text-[11px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </button>
            <button
              type="button"
              onClick={addBinding}
              className="btn-secondary flex items-center gap-2 text-[11px]"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={saveAll}
              className="btn-primary flex items-center gap-2 text-[11px]"
            >
              <Save className="h-3.5 w-3.5" />
              Lưu registry
            </button>
          </div>
        </header>

        <div className="p-3 sm:p-4">
          {loading ? (
            <p className="text-xs text-[var(--muted)]">Đang tải…</p>
          ) : (
            <div className="space-y-3">
              {bindings.map((b) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setDragId(b.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) move(dragId, b.id);
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3 shadow-sm transition ${
                    dragId === b.id ? "opacity-60 ring-2 ring-[var(--accent)]/40" : ""
                  }`}
                >
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      title="Kéo để sắp xếp"
                      className="mt-7 shrink-0 cursor-grab text-[var(--muted)] hover:text-[var(--foreground)] active:cursor-grabbing"
                      aria-label="Kéo sắp xếp"
                    >
                      <GripVertical className="h-5 w-5" />
                    </button>

                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-12">
                      <label className="flex items-center gap-2 sm:col-span-1">
                        <input
                          type="checkbox"
                          checked={b.enabled}
                          onChange={(e) => patchBinding(b.id, { enabled: e.target.checked })}
                          className="rounded"
                          title="Bật biến"
                        />
                      </label>

                      <label className="text-[10px] text-[var(--muted)] sm:col-span-2">
                        Tên khóa (vd gold → {"{{gold}}"})
                        <input
                          value={b.variableKey}
                          onChange={(e) => patchBinding(b.id, { variableKey: e.target.value.trim() })}
                          className="input mt-0.5 w-full font-mono text-[11px]"
                          placeholder="gold"
                          spellCheck={false}
                        />
                      </label>

                      <label className="text-[10px] text-[var(--muted)] sm:col-span-2">
                        Tên hiển thị UI
                        <input
                          value={b.uiLabel}
                          onChange={(e) => patchBinding(b.id, { uiLabel: e.target.value })}
                          className="input mt-0.5 w-full text-[11px]"
                          placeholder="Vàng TG"
                        />
                      </label>

                      <label className="text-[10px] text-[var(--muted)] sm:col-span-3">
                        Chú thích
                        <input
                          value={b.userNote}
                          onChange={(e) => patchBinding(b.id, { userNote: e.target.value })}
                          className="input mt-0.5 w-full text-[11px]"
                          placeholder="Ghi nhớ ngắn"
                        />
                      </label>

                      <label className="text-[10px] text-[var(--muted)] sm:col-span-2">
                        Chế độ
                        <select
                          value={b.mode}
                                  onChange={(e) =>
                            patchBinding(b.id, {
                              mode: e.target.value as ApiBindingClient["mode"],
                            })
                          }
                          className="input mt-0.5 w-full text-[11px]"
                        >
                          <option value="builtin">Built-in hub</option>
                          <option value="http">HTTP JSON</option>
                        </select>
                      </label>

                      <div className="flex items-end gap-2 sm:col-span-2">
                        <button
                          type="button"
                          disabled={testingId === b.id}
                          onClick={() => runTest(b)}
                          className="btn-secondary w-full whitespace-nowrap text-[10px] sm:flex-1"
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBinding(b.id)}
                          className="btn-secondary p-2 text-red-400 hover:bg-red-950/40"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {b.mode === "builtin" ? (
                    <label className="mt-3 block text-[10px] text-[var(--muted)] pl-9 sm:pl-12">
                      Nguồn built-in
                      <select
                        value={b.builtinKey ?? "gold_usd"}
                        onChange={(e) => patchBinding(b.id, { builtinKey: e.target.value })}
                        className="input mt-0.5 w-full text-[11px]"
                      >
                        {builtinOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="mt-3 grid gap-2 pl-9 sm:grid-cols-2 sm:pl-12">
                      <label className="text-[10px] text-[var(--muted)]">
                        URL (GET JSON)
                        <input
                          value={b.httpUrl ?? ""}
                          onChange={(e) => patchBinding(b.id, { httpUrl: e.target.value })}
                          className="input mt-0.5 w-full font-mono text-[10px]"
                          placeholder="https://api.example.com/v1/quotes"
                        />
                      </label>
                      <label className="text-[10px] text-[var(--muted)]">
                        JSON path (dot)
                        <input
                          value={b.httpPath ?? ""}
                          onChange={(e) => patchBinding(b.id, { httpPath: e.target.value })}
                          className="input mt-0.5 w-full font-mono text-[10px]"
                          placeholder="data.0.price"
                        />
                      </label>
                    </div>
                  )}

                  {tests[b.id] && (
                    <div className="mt-3 ml-9 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] bg-black/20 p-2 text-[10px] sm:ml-12">
                      {tests[b.id].ok ? (
                        <>
                          <p className="font-mono text-emerald-400">
                            Giá trị: {tests[b.id].value ?? "—"}
                          </p>
                          {tests[b.id].extras &&
                            Object.keys(tests[b.id].extras!).length > 1 && (
                              <ul className="mt-1 space-y-0.5 text-[var(--muted)]">
                                {Object.entries(tests[b.id].extras!)
                                  .filter(([k]) => k !== "value")
                                  .map(([k, v]) => (
                                    <li key={k}>
                                      <span className="text-[var(--foreground)]">{k}:</span> {String(v)}
                                    </li>
                                  ))}
                              </ul>
                            )}
                        </>
                      ) : (
                        <p className="text-red-400">{tests[b.id].error}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {bindings.length === 0 && (
                <p className="text-center text-xs text-[var(--muted)]">Chưa có binding — thêm dòng hoặc tải mặc định.</p>
              )}
            </div>
          )}

          {feedback && (
            <p className={`mt-3 text-xs ${feedback.startsWith("Đã") ? "text-emerald-400" : "text-amber-400"}`}>{feedback}</p>
          )}
        </div>
      </section>

      <SettingsSecretFields section="api" title="Bảo mật API hub (tùy chọn)" />

      <section className="settings-kv-card p-5">
        <h3 className="text-sm font-semibold">Kiểm tra kết nối thị trường (tổng)</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Gộp metals, forex, giavang — khác với Test từng biến ở trên.
        </p>
        <button
          type="button"
          disabled={marketTesting}
          onClick={testMarket}
          className="btn-primary mt-4 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${marketTesting ? "animate-spin" : ""}`} />
          Test API thị trường
        </button>
        {marketOk !== null && (
          <p
            className={`mt-3 flex items-center gap-2 text-sm ${marketOk ? "text-emerald-400" : "text-red-300"}`}
          >
            {marketOk ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {marketMsg}
          </p>
        )}
      </section>

      <SettingsAdvancedLab />
    </SettingsPageShell>
  );
}
