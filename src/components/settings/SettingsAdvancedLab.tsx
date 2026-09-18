"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Play, Terminal } from "lucide-react";

const PRESETS = [
  { label: "GET /api/hub/status", method: "GET" as const, path: "/api/hub/status" },
  { label: "GET /api/market (live)", method: "GET" as const, path: "/api/market?live=1&chartRange=7d" },
  { label: "GET /api/telegram", method: "GET" as const, path: "/api/telegram" },
  { label: "POST telegram test", method: "POST" as const, path: "/api/telegram", body: '{"action":"test"}' },
  { label: "POST hub tick", method: "POST" as const, path: "/api/hub/tick", body: "{}" },
];

interface SettingsAdvancedLabProps {
  /** Gợi ý preset bổ sung (vd chỉ API messaging). */
  extraPresets?: typeof PRESETS;
}

export function SettingsAdvancedLab({ extraPresets }: SettingsAdvancedLabProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [path, setPath] = useState("/api/hub/status");
  const [body, setBody] = useState("{}");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = extraPresets ?? PRESETS;

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const init: RequestInit = { method, cache: "no-store" };
      if (method === "POST") {
        init.headers = { "Content-Type": "application/json" };
        init.body = body.trim() || "{}";
      }
      const res = await fetch(path.startsWith("/") ? path : `/${path}`, init);
      const text = await res.text();
      try {
        setResult(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResult(text.slice(0, 8000));
      }
      if (!res.ok) setError(`HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="settings-kv-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Terminal className="h-4 w-4 text-[var(--accent)]" />
          Cài đặt nâng cao — thử API / lệnh
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--border)] px-5 pb-5 pt-4">
          <p className="text-xs text-[var(--muted)]">
            Chỉ gọi endpoint local. Dùng để debug sau này — mặc định ẩn để giao diện gọn.
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="tab-pill text-[10px]"
                onClick={() => {
                  setMethod(p.method);
                  setPath(p.path);
                  if ("body" in p && p.body) setBody(p.body);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "GET" | "POST")}
              className="input"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="input font-mono text-xs"
              placeholder="/api/..."
            />
          </div>
          {method === "POST" && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="input w-full resize-y font-mono text-xs"
              placeholder='{"action":"test"}'
            />
          )}
          <button type="button" disabled={running} onClick={run} className="btn-primary flex items-center gap-2">
            <Play className="h-4 w-4" />
            Chạy thử
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
          {result && (
            <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-emerald-200/90">
              {result}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
