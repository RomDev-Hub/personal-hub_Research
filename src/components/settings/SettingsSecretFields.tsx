"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, RotateCcw, Save } from "lucide-react";
import { FieldInfoTip } from "./FieldInfoTip";
import { FIELD_HELP } from "./settings-field-help";

interface ConfigFieldView {
  key: string;
  label: string;
  envKey: string;
  masked: string;
  hasValue: boolean;
  source: "file" | "env" | "none";
  editable: boolean;
}

interface SettingsSecretFieldsProps {
  section: "telegram" | "api";
  title?: string;
}

const SOURCE_LABEL: Record<ConfigFieldView["source"], string> = {
  file: "File hub-config",
  env: ".env.local",
  none: "Chưa có",
};

export function SettingsSecretFields({ section, title = "Thông tin kết nối" }: SettingsSecretFieldsProps) {
  const [fields, setFields] = useState<ConfigFieldView[]>([]);
  const [hasBackup, setHasBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hub/config?section=${section}`, { cache: "no-store" });
      const json = (await res.json()) as { fields: ConfigFieldView[]; hasBackup: boolean };
      setFields(json.fields ?? []);
      setHasBackup(json.hasBackup ?? false);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hub/config?section=${section}`, { cache: "no-store" });
        const json = (await res.json()) as { fields: ConfigFieldView[]; hasBackup: boolean };
        if (!cancelled) {
          setFields(json.fields ?? []);
          setHasBackup(json.hasBackup ?? false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  async function postConfig(body: Record<string, string>) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/hub/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Lỗi");
      setEditingKey(null);
      setDraft("");
      setReveal(false);
      await load();
      setFeedback(
        "Đã lưu vĩnh viễn vào data/hub-config.json — lần sau chạy app vẫn còn (ghi đè .env khi có giá trị file).",
      );
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function restoreBackup() {
    await postConfig({ action: "restore_backup" });
    setFeedback("Đã khôi phục bản trước lần sửa gần nhất.");
  }

  async function restoreEnv() {
    await postConfig({ action: "restore_env" });
    setFeedback("Đã xóa ghi đè file — dùng lại .env.local.");
  }

  if (loading && !fields.length) {
    return <p className="text-sm text-[var(--muted)]">Đang tải cấu hình…</p>;
  }

  if (!fields.length) {
    return null;
  }

  return (
    <section className="settings-kv-card">
      <header className="settings-kv-card-header">
        <h3 className="settings-kv-card-title">{title}</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Bấm <strong className="text-[var(--foreground)]">ⓘ</strong> cạnh tên trường để xem hướng dẫn lấy
          token/chat ID. Bấm <strong className="text-[var(--foreground)]">Sửa → Lưu</strong> sẽ{" "}
          <strong className="text-[var(--accent)]">ghi đè file</strong>{" "}
          <code className="text-[var(--accent)]">data/hub-config.json</code> trên máy — không mất khi tắt tab hay
          khởi động lại Hub (ưu tiên hơn <code>.env.local</code>).
        </p>
      </header>

      <dl className="settings-kv-list">
        {fields.map((f) => (
          <div key={f.key} className="border-b border-[var(--border)] last:border-b-0">
            <div className="settings-kv-row settings-secret-row">
            <dt className="space-y-1">
              <span className="inline-flex items-center">
                {f.label}
                {FIELD_HELP[f.key] && (
                  <FieldInfoTip
                    label={FIELD_HELP[f.key].title}
                    active={openHelpKey === f.key}
                    onToggle={() => setOpenHelpKey(openHelpKey === f.key ? null : f.key)}
                  />
                )}
              </span>
              <span className="block font-mono text-[10px] font-normal normal-case text-[var(--muted)]">
                {f.envKey}
              </span>
            </dt>
            <dd className="space-y-2 sm:text-right">
              {editingKey === f.key ? (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={reveal ? "text" : "password"}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="input w-full font-mono text-xs pr-10"
                      placeholder={
                        f.key === "telegram.chatId"
                          ? "Chỉ số, vd 123456789 (không phải @tên_bot)"
                          : "Nhập giá trị mới…"
                      }
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                      onClick={() => setReveal((v) => !v)}
                      aria-label={reveal ? "Ẩn" : "Hiện"}
                    >
                      {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      className="btn-primary flex items-center gap-1 text-xs"
                      onClick={() => postConfig({ action: "save", key: f.key, value: draft })}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Lưu
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setEditingKey(null);
                        setDraft("");
                        setReveal(false);
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-mono text-sm tracking-wide text-[var(--foreground)]">{f.masked}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    Nguồn: <span className="text-[var(--accent)]">{SOURCE_LABEL[f.source]}</span>
                    {f.hasValue ? "" : " · chưa cấu hình"}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setEditingKey(f.key);
                        setDraft("");
                        setReveal(false);
                      }}
                    >
                      Sửa
                    </button>
                    {f.source === "file" && (
                      <button
                        type="button"
                        className="btn-secondary text-xs text-amber-400"
                        onClick={() => postConfig({ action: "clear", key: f.key })}
                      >
                        Dùng .env
                      </button>
                    )}
                  </div>
                </>
              )}
            </dd>
            </div>
            {openHelpKey === f.key && FIELD_HELP[f.key] && (
              <div className="settings-inline-help border-t border-[var(--border)]/60 bg-[var(--surface)]/40 px-4 py-3 sm:px-5">
                <p className="mb-2 text-[11px] font-medium text-[var(--accent)]">{FIELD_HELP[f.key].title}</p>
                {FIELD_HELP[f.key].body}
              </div>
            )}
          </div>
        ))}
      </dl>

      <footer className="settings-kv-footer flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">{feedback}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasBackup || saving}
            onClick={restoreBackup}
            className="btn-secondary flex items-center gap-1 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục bản trước
          </button>
          <button type="button" disabled={saving} onClick={restoreEnv} className="btn-secondary text-xs">
            Xóa ghi đè file
          </button>
        </div>
      </footer>
    </section>
  );
}
