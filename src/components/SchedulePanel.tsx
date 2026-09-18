"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { SCHEDULE_ACTION_LABELS, WEEKDAY_LABELS } from "@/lib/schedule-constants";
import type { ScheduleAction, ScheduleJob } from "@/lib/types";

function formatJobDays(days: number[]): string {
  if (!days.length) return "Mỗi ngày";
  return WEEKDAY_LABELS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(", ");
}

export function SchedulePanel() {
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Bản tin sáng");
  const [time, setTime] = useState("08:00");
  const [action, setAction] = useState<ScheduleAction>("digest");
  const [customMessage, setCustomMessage] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  const editLabel = useMemo(
    () => (editingId ? "Cập nhật lịch" : "Thêm lịch"),
    [editingId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule");
      const json = (await res.json()) as { jobs: ScheduleJob[]; error?: string };
      if (json.error) throw new Error(json.error);
      setJobs(json.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải lịch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function resetFormDefaults() {
    setEditingId(null);
    setName("Bản tin sáng");
    setTime("08:00");
    setAction("digest");
    setCustomMessage("");
    setDays([]);
  }

  function startEdit(job: ScheduleJob) {
    setEditingId(job.id);
    setName(job.name);
    setTime(job.time);
    setAction(job.action);
    setCustomMessage(job.customMessage ?? "");
    setDays([...job.days]);
    setError(null);
    setFeedback(null);
    setFormOpen(true);
  }

  async function submitJob() {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const existing = editingId ? jobs.find((j) => j.id === editingId) : undefined;
      const body: Record<string, unknown> = {
        name,
        time,
        days,
        action,
        customMessage: action === "custom" ? customMessage : undefined,
        enabled: existing?.enabled ?? true,
      };
      if (editingId) body.id = editingId;

      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại");
      setFeedback(editingId ? "Đã cập nhật lịch." : "Đã thêm lịch gửi.");
      resetFormDefaults();
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function removeJob(id: string) {
    if (editingId === id) resetFormDefaults();
    await fetch(`/api/schedule?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  async function toggleJobEnabled(job: ScheduleJob) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job.id,
          name: job.name,
          time: job.time,
          days: job.days,
          action: job.action,
          customMessage: job.action === "custom" ? job.customMessage : undefined,
          enabled: !job.enabled,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Lỗi bật/tắt");
      setFeedback(!job.enabled ? "Đã bật lịch." : "Đã tắt lịch (worker sẽ bỏ qua).");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function sendNow(job: ScheduleJob) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_schedule_now", job }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      setFeedback(json.ok ? `Đã gửi: ${job.name}` : (json.error ?? "Gửi thất bại"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-kv-card">
      <header className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              Lịch gửi tự động
              {!loading && jobs.length > 0 && (
                <span className="font-normal text-[var(--muted)]">({jobs.length})</span>
              )}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Worker <code className="text-[var(--accent)]">./scripts/start.sh</code> chạy tick — bật/tắt, sửa,
              gửi thử từng lịch bên dưới.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (formOpen && editingId) resetFormDefaults();
              setFormOpen((v) => !v);
            }}
            className="btn-secondary shrink-0 text-xs"
          >
            {formOpen ? "Đóng form" : "+ Thêm lịch"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        {feedback && <p className="mt-2 text-xs text-emerald-400">{feedback}</p>}
      </header>

      <ul className="space-y-2 px-5 py-3">
        {loading ? (
          <li className="text-xs text-[var(--muted)]">Đang tải...</li>
        ) : jobs.length === 0 ? (
          <li className="text-xs text-[var(--muted)]">
            Chưa có lịch — bấm <strong className="text-[var(--foreground)]">+ Thêm lịch</strong> để tạo (vd 08:00
            bản tin sáng).
          </li>
        ) : (
          jobs.map((job) => (
            <li
              key={job.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                job.enabled
                  ? "border-[var(--border)] bg-[var(--surface)]/80"
                  : "border-dashed border-[var(--border)] bg-[var(--surface)]/40 opacity-70"
              }`}
            >
              <div className="min-w-0">
                <span className="font-medium text-[var(--foreground)]">{job.name}</span>
                <span className="ml-2 font-mono text-[var(--accent)]">{job.time}</span>
                <span className="ml-2 text-[var(--muted)]">{formatJobDays(job.days)}</span>
                <div className="mt-0.5 text-[var(--muted)]">{SCHEDULE_ACTION_LABELS[job.action]}</div>
                {job.lastRunDate && (
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">Đã chạy: {job.lastRunDate}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title={job.enabled ? "Tắt gửi tự động" : "Bật lại"}
                  disabled={saving}
                  onClick={() => toggleJobEnabled(job)}
                  className="btn-secondary p-1.5"
                >
                  {job.enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  title="Sửa lịch"
                  disabled={saving}
                  onClick={() => startEdit(job)}
                  className={`btn-secondary p-1.5 ${editingId === job.id ? "ring-2 ring-[var(--accent)]" : ""}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Gửi ngay"
                  disabled={saving}
                  onClick={() => sendNow(job)}
                  className="btn-secondary p-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => removeJob(job.id)}
                  className="btn-secondary p-1.5 text-red-400"
                  title="Xóa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <button
        type="button"
        onClick={() => setFormOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3 text-left text-sm font-medium"
      >
        <span className="text-[var(--muted)]">
          {editingId ? <span className="text-[var(--accent)]">Đang sửa lịch</span> : "Thêm hoặc chỉnh lịch"}
        </span>
        {formOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {formOpen && (
        <div className="space-y-3 border-t border-[var(--border)] px-5 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-[var(--muted)]">
              Tên lịch
              <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1 w-full" />
            </label>
            <label className="text-xs text-[var(--muted)]">
              Giờ (24h)
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input mt-1 w-full"
              />
            </label>
            <label className="text-xs text-[var(--muted)]">
              Nội dung gửi
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as ScheduleAction)}
                className="input mt-1 w-full"
              >
                {(Object.keys(SCHEDULE_ACTION_LABELS) as ScheduleAction[]).map((k) => (
                  <option key={k} value={k}>
                    {SCHEDULE_ACTION_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={submitJob}
                className="btn-primary flex min-w-[8rem] flex-1 items-center justify-center gap-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {editLabel}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    resetFormDefaults();
                    setFormOpen(false);
                  }}
                  className="btn-secondary text-xs"
                >
                  Hủy sửa
                </button>
              )}
            </div>
          </div>

          {action === "custom" && (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Nội dung tin nhắn HTML được hỗ trợ..."
              rows={3}
              className="input w-full resize-y text-xs"
            />
          )}

          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">Ngày trong tuần (để trống = mỗi ngày)</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`tab-pill text-[10px] ${days.includes(d.value) ? "tab-pill-active" : ""}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
