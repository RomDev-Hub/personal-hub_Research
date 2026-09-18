"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface SettingsPageShellProps {
  title: string;
  titleAccent?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Trang nhiều form (Telegram) — rộng hơn trên màn lớn. */
  wide?: boolean;
  children: ReactNode;
}

export function SettingsPageShell({
  title,
  titleAccent,
  subtitle,
  onBack,
  backLabel = "Cài đặt",
  wide = false,
  children,
}: SettingsPageShellProps) {
  return (
    <div
      className={`mx-auto w-full space-y-5 ${wide ? "max-w-3xl xl:max-w-6xl 2xl:max-w-7xl" : "max-w-3xl"}`}
    >
      {onBack && (
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      )}
      <div>
        <h2 className="settings-page-title">
          {title}
          {titleAccent ? <span className="text-[var(--accent)]"> {titleAccent}</span> : null}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
