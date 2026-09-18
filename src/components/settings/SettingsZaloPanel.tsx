"use client";

import { SettingsPageShell } from "./SettingsPageShell";

interface SettingsZaloPanelProps {
  onBack: () => void;
}

export function SettingsZaloPanel({ onBack }: SettingsZaloPanelProps) {
  return (
    <SettingsPageShell
      title="CÀI ĐẶT"
      titleAccent="ZALO"
      subtitle="Kênh Zalo OA / ZNS — đang lên kế hoạch."
      onBack={onBack}
    >
      <section className="settings-kv-card border-dashed p-8 text-center">
        <p className="text-sm font-medium">Sắp có</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Cấu hình OA ID, secret, template ZNS và test gửi tin — giống luồng Telegram. Hiện tại dùng tab Telegram
          trong Cài đặt.
        </p>
      </section>
    </SettingsPageShell>
  );
}
