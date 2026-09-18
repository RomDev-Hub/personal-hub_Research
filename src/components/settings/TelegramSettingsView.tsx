"use client";

import { Send } from "lucide-react";
import { SettingsAdvancedLab } from "./SettingsAdvancedLab";
import { SettingsSecretFields } from "./SettingsSecretFields";
import { SettingsPageShell } from "./SettingsPageShell";
import { TelegramPanel } from "../TelegramPanel";

const TELEGRAM_PRESETS = [
  { label: "GET status", method: "GET" as const, path: "/api/telegram" },
  { label: "POST test", method: "POST" as const, path: "/api/telegram", body: '{"action":"test"}' },
  { label: "POST poll", method: "POST" as const, path: "/api/telegram", body: '{"action":"poll"}' },
];

interface TelegramSettingsViewProps {
  onBack: () => void;
}

export function TelegramSettingsView({ onBack }: TelegramSettingsViewProps) {
  return (
    <SettingsPageShell
      title="CẤU HÌNH"
      titleAccent="TELEGRAM"
      subtitle="Kết nối bot, lịch gửi tự động, cấu hình phản hồi lệnh từ Telegram."
      onBack={onBack}
      wide
    >
      <div className="settings-provider-hero">
        <span className="settings-provider-icon settings-provider-icon-telegram">
          <Send className="h-5 w-5 text-white" />
        </span>
        <div>
          <p className="text-sm font-semibold">Telegram Bot</p>
          <p className="text-xs text-[var(--muted)]">
            Token + Chat ID trong <code className="text-[var(--accent)]">.env.local</code> — không lưu trên giao
            diện.
          </p>
        </div>
      </div>

      <SettingsSecretFields section="telegram" title="Token & Chat ID" />

      <TelegramPanel embedded showAdvanced={false} />
      <SettingsAdvancedLab extraPresets={TELEGRAM_PRESETS} />
    </SettingsPageShell>
  );
}
