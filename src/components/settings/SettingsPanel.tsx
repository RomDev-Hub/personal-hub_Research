"use client";

import { SettingsHubIndex, type SettingsPanelId } from "./SettingsHubIndex";
import { SettingsSystemPanel } from "./SettingsSystemPanel";
import { SettingsDataSourcesPanel } from "./SettingsDataSourcesPanel";
import { SettingsZaloPanel } from "./SettingsZaloPanel";
import { TelegramSettingsView } from "./TelegramSettingsView";

interface SettingsPanelProps {
  panel: SettingsPanelId | null;
  onPanelChange: (panel: SettingsPanelId | null) => void;
}

export function SettingsPanel({ panel, onPanelChange }: SettingsPanelProps) {
  if (!panel) return <SettingsHubIndex onSelect={onPanelChange} />;
  if (panel === "hub") return <SettingsSystemPanel onBack={() => onPanelChange(null)} />;
  if (panel === "api") return <SettingsDataSourcesPanel onBack={() => onPanelChange(null)} />;
  if (panel === "telegram") return <TelegramSettingsView onBack={() => onPanelChange(null)} />;
  if (panel === "zalo") return <SettingsZaloPanel onBack={() => onPanelChange(null)} />;
  return <SettingsHubIndex onSelect={onPanelChange} />;
}

export type { SettingsPanelId };
