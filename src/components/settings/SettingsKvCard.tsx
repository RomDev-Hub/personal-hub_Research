"use client";

import type { ReactNode } from "react";

interface KvRow {
  label: string;
  value: string;
  valueClassName?: string;
}

interface SettingsKvCardProps {
  title: string;
  titleAccent?: string;
  rows: KvRow[];
  footer?: ReactNode;
}

export function SettingsKvCard({ title, titleAccent, rows, footer }: SettingsKvCardProps) {
  return (
    <section className="settings-kv-card">
      <header className="settings-kv-card-header">
        <h3 className="settings-kv-card-title">
          {title}
          {titleAccent ? <span className="text-[var(--accent)]"> {titleAccent}</span> : null}
        </h3>
      </header>
      <dl className="settings-kv-list">
        {rows.map((row) => (
          <div key={row.label} className="settings-kv-row">
            <dt>{row.label}</dt>
            <dd className={row.valueClassName ?? ""}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <footer className="settings-kv-footer">{footer}</footer>}
    </section>
  );
}
