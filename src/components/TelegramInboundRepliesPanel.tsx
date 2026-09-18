"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Eye,
  MessageCircleReply,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type {
  ReplyBuiltinKind,
  SavedMessageTemplate,
  TelegramReplyCommand,
} from "@/lib/telegram-replies";
import {
  getDefaultReplyTemplate,
  QUICK_REPLY_PRESETS,
} from "@/lib/telegram-reply-templates";

const DATA_SOURCE_LABELS: Record<ReplyBuiltinKind, string> = {
  help: "Help",
  market: "Giá live",
  digest: "Bản tin",
  news: "RSS",
  custom: "Tự do",
};

function splitCsv(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinCsv(arr: string[]): string {
  return arr.join(", ");
}

type RegistryRow = {
  variableKey: string;
  uiLabel: string;
  userNote: string;
  enabled: boolean;
};

function templateTokenFromKey(variableKey: string): string | null {
  const k = variableKey.replace(/^\{\{?/, "").replace(/\}\}?$/, "").replace(/[{}]/g, "").trim();
  return k ? `{{${k}}}` : null;
}

function mergeVariableOptions(registry: RegistryRow[], hints: string[]): { token: string; primary: string; note: string }[] {
  const map = new Map<string, { token: string; primary: string; note: string }>();
  for (const b of registry) {
    const token = templateTokenFromKey(b.variableKey);
    if (!b.enabled || !token) continue;
    map.set(token, {
      token,
      primary: (b.uiLabel || token.replace(/[{}]/g, "")).trim(),
      note: b.userNote?.trim() || "—",
    });
  }
  for (const h of hints) {
    const trimmed = h.trim();
    if (!trimmed.startsWith("{{")) continue;
    if (!map.has(trimmed)) {
      map.set(trimmed, {
        token: trimmed,
        primary: trimmed,
        note: "Biến hệ thống",
      });
    }
  }
  return [...map.values()].sort((a, b) => a.primary.localeCompare(b.primary, "vi"));
}

export function TelegramInboundRepliesPanel() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [globalOpen, setGlobalOpen] = useState(false);
  const [commands, setCommands] = useState<TelegramReplyCommand[]>([]);
  const [defaultDisabledReply, setDefaultDisabledReply] = useState("");
  const [unknownReply, setUnknownReply] = useState("");
  const [variableHints, setVariableHints] = useState<string[]>([]);
  const [registryRows, setRegistryRows] = useState<RegistryRow[]>([]);
  const [varPick, setVarPick] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedMessageTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{ subtitle: string; text: string } | null>(null);

  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const lastFocusCommandId = useRef<string | null>(null);
  const restoreCursor = useRef<{ commandId: string; pos: number } | null>(null);

  const mergedVars = useMemo(() => mergeVariableOptions(registryRows, variableHints), [registryRows, variableHints]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [repliesRes, apiRes] = await Promise.all([
        fetch("/api/telegram/replies", { cache: "no-store" }),
        fetch("/api/hub/api-variables", { cache: "no-store" }),
      ]);
      const json = (await repliesRes.json()) as {
        commands: TelegramReplyCommand[];
        defaultDisabledReply?: string;
        unknownReply?: string;
        variableHints?: string[];
        savedTemplates?: SavedMessageTemplate[];
      };
      setCommands(json.commands ?? []);
      setDefaultDisabledReply(json.defaultDisabledReply ?? "");
      setUnknownReply(json.unknownReply ?? "");
      setVariableHints(json.variableHints ?? []);
      setSavedTemplates(json.savedTemplates ?? []);
      const apiJson = (await apiRes.json()) as { bindings?: RegistryRow[] };
      setRegistryRows(apiJson.bindings ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!varPick && mergedVars.length > 0) setVarPick(mergedVars[0].token);
  }, [mergedVars, varPick]);

  useLayoutEffect(() => {
    const r = restoreCursor.current;
    if (!r) return;
    restoreCursor.current = null;
    const el = textareaRefs.current.get(r.commandId);
    if (!el) return;
    el.focus();
    el.setSelectionRange(r.pos, r.pos);
  }, [commands]);

  function patchCommand(id: string, patch: Partial<TelegramReplyCommand>) {
    setCommands((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function insertSelectedVariable() {
    const token = varPick.trim();
    if (!token) {
      setFeedback("Chọn biến trong danh sách.");
      return;
    }
    const fallbackId = [...expandedIds][expandedIds.size - 1] ?? commands[0]?.id ?? null;
    const commandId = lastFocusCommandId.current ?? fallbackId;
    if (!commandId) {
      setFeedback("Chưa có nhóm để chèn.");
      return;
    }
    const ta = textareaRefs.current.get(commandId);
    if (!ta) {
      setFeedback('Mở nhóm và bấm vào ô "Nội dung HTML" trước khi chèn.');
      return;
    }
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const cmd = commands.find((c) => c.id === commandId);
    const cur = cmd?.template ?? "";
    const next = cur.slice(0, start) + token + cur.slice(end);
    restoreCursor.current = { commandId, pos: start + token.length };
    patchCommand(commandId, { template: next });
  }

  function addCommand() {
    const n = commands.length + 1;
    const id = `group-${Date.now()}`;
    setCommands((list) => [
      ...list,
      {
        id,
        label: `Nhóm ${n}`,
        enabled: false,
        commands: [`/cmd${n}`],
        keywords: [],
        kind: "custom",
        template: getDefaultReplyTemplate("custom"),
        disabledReply: "",
      },
    ]);
    setPanelOpen(true);
    setExpandedIds((prev) => new Set(prev).add(id));
  }

  function applyQuickPreset(commandId: string, presetId: number) {
    const preset = QUICK_REPLY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (!confirm(`${preset.label} — ghi đè nội dung HTML và nguồn dữ liệu của nhóm này?`)) return;
    patchCommand(commandId, { template: preset.template, kind: preset.kind });
  }

  async function saveAll() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          commands,
          defaultDisabledReply,
          unknownReply,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại");
      setFeedback("Đã lưu — bot dùng ngay lần poll tiếp theo.");
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!confirm("Khôi phục mặc định toàn bộ nhóm phản hồi? (Mẫu đã lưu không bị xóa.)")) return;
    setSaving(true);
    try {
      await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      setExpandedIds(new Set());
      await load();
      setFeedback("Đã khôi phục mặc định.");
    } finally {
      setSaving(false);
    }
  }

  async function preview(id: string, send: boolean) {
    setTestingId(id);
    setFeedback(null);
    try {
      const res = await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: send ? "test" : "preview", commandId: id, send }),
      });
      const json = (await res.json()) as { ok?: boolean; text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Thất bại");
      if (json.text && !send) {
        const ix = commands.findIndex((c) => c.id === id);
        const subtitle = ix >= 0 ? `Nhóm ${ix + 1} · ${commands[ix].label}` : id;
        setPreviewModal({ subtitle, text: json.text });
      }
      if (send) setFeedback(json.ok ? "Đã gửi thử Telegram." : (json.error ?? "Gửi thất bại"));
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setTestingId(null);
    }
  }

  async function saveTemplateSnapshot() {
    const name = templateName.trim();
    if (!name) {
      setFeedback("Nhập tên mẫu để lưu.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saveRes = await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          commands,
          defaultDisabledReply,
          unknownReply,
        }),
      });
      const saveJson = (await saveRes.json()) as { error?: string };
      if (!saveRes.ok) throw new Error(saveJson.error ?? "Không lưu được form hiện tại");

      const res = await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_template", templateName: name }),
      });
      const json = (await res.json()) as { savedTemplates?: SavedMessageTemplate[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Lưu mẫu thất bại");
      setSavedTemplates(json.savedTemplates ?? []);
      setTemplateName("");
      setFeedback(`Đã lưu form + mẫu "${name}".`);
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTpl(id: string) {
    if (!confirm("Xóa mẫu này khỏi danh sách?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_template", templateId: id }),
      });
      const json = (await res.json()) as { savedTemplates?: SavedMessageTemplate[] };
      if (res.ok) setSavedTemplates(json.savedTemplates ?? []);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function applyTpl(templateId: string) {
    if (!confirm("Áp dụng mẫu sẽ ghi đè nội dung trên form (chưa Lưu tất cả có thể mất)?")) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/telegram/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_template", templateId }),
      });
      const json = (await res.json()) as {
        commands?: TelegramReplyCommand[];
        defaultDisabledReply?: string;
        unknownReply?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Áp dụng thất bại");
      if (json.commands) setCommands(json.commands);
      if (json.defaultDisabledReply !== undefined) setDefaultDisabledReply(json.defaultDisabledReply);
      if (json.unknownReply !== undefined) setUnknownReply(json.unknownReply);
      setFeedback("Đã áp dụng mẫu — kiểm tra rồi bấm Lưu tất cả.");
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-kv-card w-full">
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <MessageCircleReply className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="min-w-0 leading-tight">Cấu hình nội dung tin nhắn (phản hồi lệnh Telegram)</span>
          {!loading && (
            <span className="font-normal text-[var(--muted)]">
              ({commands.filter((c) => c.enabled).length}/{commands.length} bật)
            </span>
          )}
        </span>
        {panelOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {panelOpen && (
        <div className="space-y-3 border-t border-[var(--border)] px-4 pb-4 pt-3 sm:px-6">
          <p className="text-[10px] leading-relaxed text-[var(--muted)]">
            Telegram gửi lệnh → bot ghép nhóm và thay biến <code className="text-[var(--accent)]">{"{{...}}"}</code>.
            Biến từ tab <strong>Cài đặt → API</strong> xuất hiện ở danh dưới. Chèn vào chỗ trỏ chuột trong ô HTML —{" "}
            <strong>Xem trước</strong> mở cửa sổ không chiếm chỗ trong form.
          </p>

          {!loading && (
            <div className="rounded-lg border border-[var(--border)]/70 bg-black/20 p-3">
              <p className="text-[10px] font-semibold text-[var(--foreground)]">
                Chèn biến vào nội dung HTML
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="block min-w-0 flex-1 text-[10px] text-[var(--muted)] sm:max-w-xl">
                  Chọn biến
                  <select
                    value={varPick}
                    onChange={(e) => setVarPick(e.target.value)}
                    className="input mt-0.5 w-full max-w-xl text-[11px]"
                  >
                    {mergedVars.length === 0 ? (
                      <option value="">(Chưa có — cấu hình API hoặc tải lại)</option>
                    ) : (
                      mergedVars.map((v) => (
                        <option key={v.token} value={v.token}>
                          {v.primary} · {v.token}
                          {v.note && v.note !== "—" ? ` — ${v.note}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={insertSelectedVariable}
                  className="btn-primary shrink-0 text-[10px] sm:h-9"
                >
                  Insert tại trỏ chuột
                </button>
              </div>
            </div>
          )}

          {!loading && (
            <div className="rounded-lg border border-[var(--border)]/70 bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Bookmark className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <p className="text-[10px] font-semibold text-[var(--foreground)]">Mẫu của bạn</p>
              </div>
              <p className="mt-1 text-[9px] text-[var(--muted)]">
                Khi bấm <b className="text-[var(--foreground)]">Thêm mẫu</b>, hệ thống{" "}
                <b className="text-[var(--foreground)]">lưu luôn form hiện tại</b> rồi gắn vào tên mẫu.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="input min-w-[12rem] flex-1 text-[11px] sm:max-w-xs"
                  placeholder="Tên mẫu, ví dụ: Giá sáng Thứ 2"
                  maxLength={80}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveTemplateSnapshot()}
                  className="btn-secondary shrink-0 text-[10px]"
                >
                  Thêm mẫu
                </button>
              </div>
              {savedTemplates.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto border-t border-[var(--border)]/50 pt-2 text-[10px]">
                  {savedTemplates.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/20 px-2 py-1.5"
                    >
                      <span className="min-w-0 font-medium">{t.name}</span>
                      <span className="flex shrink-0 flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={saving}
                          className="tab-pill text-[9px]"
                          onClick={() => applyTpl(t.id)}
                        >
                          Áp dụng
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="p-1 text-red-400 hover:bg-red-950/40"
                          title="Xóa mẫu"
                          onClick={() => deleteTpl(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-[10px] text-[var(--muted)]">Đang tải…</p>
          ) : (
            <div className="space-y-2">
              {commands.map((cmd, index) => {
                const groupNo = index + 1;
                const expanded = expandedIds.has(cmd.id);
                const syntax = joinCsv(cmd.commands) || "—";

                return (
                  <article
                    key={cmd.id}
                    className={`overflow-hidden rounded-lg border ${
                      cmd.enabled
                        ? "border-[var(--border)] bg-[var(--surface)]/50"
                        : "border-dashed border-[var(--border)] opacity-80"
                    }`}
                  >
                    <div className="flex items-stretch gap-0">
                      <label className="flex cursor-pointer items-center border-r border-[var(--border)]/60 px-2.5">
                        <input
                          type="checkbox"
                          checked={cmd.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            patchCommand(cmd.id, { enabled: e.target.checked });
                          }}
                          className="rounded"
                          title="Bật phản hồi"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(cmd.id)}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-[11px]">
                          <span className="shrink-0 font-bold text-[var(--accent)]">Nhóm {groupNo}</span>
                          <span className="truncate font-medium text-[var(--foreground)]">{cmd.label}</span>
                        </span>
                        <span className="truncate font-mono text-[10px] text-[var(--muted)] sm:flex-1">
                          {syntax}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(cmd.id)}
                        className="flex items-center px-2.5 text-[var(--muted)] hover:text-[var(--foreground)]"
                        aria-label={expanded ? "Thu gọn" : "Mở chỉnh"}
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>

                    {expanded && (
                      <div className="space-y-2 border-t border-[var(--border)]/60 bg-black/15 px-3 py-3 sm:px-4">
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="min-w-[8rem] flex-1 text-[10px] text-[var(--muted)]">
                            Tên nhóm
                            <input
                              value={cmd.label}
                              onChange={(e) => patchCommand(cmd.id, { label: e.target.value })}
                              className="input mt-0.5 w-full text-[11px]"
                              placeholder={`Nhóm ${groupNo}`}
                            />
                          </label>
                          <label className="text-[10px] text-[var(--muted)]">
                            Nguồn dữ liệu
                            <select
                              value={cmd.kind}
                              onChange={(e) =>
                                patchCommand(cmd.id, { kind: e.target.value as ReplyBuiltinKind })
                              }
                              className="input mt-0.5 text-[10px]"
                            >
                              {(Object.keys(DATA_SOURCE_LABELS) as ReplyBuiltinKind[]).map((k) => (
                                <option key={k} value={k}>
                                  {DATA_SOURCE_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="w-full text-[9px] uppercase tracking-wide text-[var(--muted)]">
                            Áp mẫu nhanh (ghi đè HTML)
                          </span>
                          {QUICK_REPLY_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="tab-pill text-[9px]"
                              onClick={() => applyQuickPreset(cmd.id, p.id)}
                            >
                              Mẫu {p.id}
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-2 lg:grid-cols-2">
                          <label className="text-[10px] text-[var(--muted)]">
                            Cú pháp lệnh
                            <input
                              value={joinCsv(cmd.commands)}
                              onChange={(e) => patchCommand(cmd.id, { commands: splitCsv(e.target.value) })}
                              className="input mt-0.5 w-full font-mono text-[10px]"
                            />
                          </label>
                          <label className="text-[10px] text-[var(--muted)]">
                            Từ khóa (tùy chọn)
                            <input
                              value={joinCsv(cmd.keywords)}
                              onChange={(e) => patchCommand(cmd.id, { keywords: splitCsv(e.target.value) })}
                              className="input mt-0.5 w-full text-[10px]"
                            />
                          </label>
                        </div>

                        <label className="block text-[10px] text-[var(--muted)]">
                          Nội dung HTML
                          <textarea
                            ref={(el) => {
                              const m = textareaRefs.current;
                              if (el) {
                                m.set(cmd.id, el);
                              } else {
                                m.delete(cmd.id);
                              }
                            }}
                            value={cmd.template ?? ""}
                            onChange={(e) => patchCommand(cmd.id, { template: e.target.value })}
                            onFocus={() => {
                              lastFocusCommandId.current = cmd.id;
                            }}
                            rows={7}
                            className="input reply-group-textarea"
                            spellCheck={false}
                          />
                        </label>

                        <label className="block text-[10px] text-[var(--muted)]">
                          Tin khi tắt ({"{{command}}"}, {"{{label}}"})
                          <input
                            value={cmd.disabledReply ?? ""}
                            onChange={(e) => patchCommand(cmd.id, { disabledReply: e.target.value })}
                            className="input mt-0.5 w-full text-[10px]"
                            placeholder="Trống = dùng mẫu chung"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={testingId === cmd.id}
                            onClick={() => preview(cmd.id, false)}
                            className="btn-secondary flex items-center gap-1 text-[10px]"
                          >
                            <Eye className="h-3 w-3" />
                            Xem trước (popup)
                          </button>
                          <button
                            type="button"
                            disabled={testingId === cmd.id}
                            onClick={() => preview(cmd.id, true)}
                            className="btn-primary flex items-center gap-1 text-[10px]"
                          >
                            <Play className="h-3 w-3" />
                            Gửi thử
                          </button>
                        </div>

                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)]/60 bg-black/15">
            <button
              type="button"
              onClick={() => setGlobalOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-medium text-[var(--muted)]"
            >
              Cài đặt chung & biến
              {globalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {globalOpen && (
              <div className="space-y-2 border-t border-[var(--border)]/60 px-3 pb-3 pt-2">
                <label className="block text-[10px] text-[var(--muted)]">
                  Tin khi lệnh tắt
                  <textarea
                    value={defaultDisabledReply}
                    onChange={(e) => setDefaultDisabledReply(e.target.value)}
                    rows={2}
                    className="input reply-group-textarea"
                  />
                </label>
                <label className="block text-[10px] text-[var(--muted)]">
                  Tin khi không khớp lệnh
                  <textarea
                    value={unknownReply}
                    onChange={(e) => setUnknownReply(e.target.value)}
                    rows={2}
                    className="input reply-group-textarea"
                  />
                </label>
                <p className="text-[9px] leading-relaxed text-[var(--muted)]">{variableHints.join(" · ")}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addCommand} className="btn-secondary flex items-center gap-1 text-[10px]">
              <Plus className="h-3 w-3" />
              Thêm nhóm
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveAll}
              className="btn-primary flex items-center gap-1 text-[10px]"
            >
              <Save className="h-3 w-3" />
              Lưu tất cả
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={resetDefaults}
              className="btn-secondary flex items-center gap-1 text-[10px]"
            >
              <RotateCcw className="h-3 w-3" />
              Mặc định
            </button>
          </div>

          {feedback && <p className="text-[10px] text-[var(--accent)]">{feedback}</p>}
        </div>
      )}

      {previewModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng"
            onClick={() => setPreviewModal(null)}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <div>
                <p id="preview-modal-title" className="text-sm font-semibold text-[var(--foreground)]">
                  Xem trước nội dung Telegram
                </p>
                <p className="text-[11px] text-[var(--muted)]">{previewModal.subtitle}</p>
              </div>
              <button type="button" className="btn-secondary text-[11px]" onClick={() => setPreviewModal(null)}>
                Đóng
              </button>
            </div>
            <pre className="max-h-[70vh] min-h-[12rem] overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
              {previewModal.text}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
