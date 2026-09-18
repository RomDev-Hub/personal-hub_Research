"use client";

import { ChevronRight, Database, MessageCircle, Settings2, Smartphone } from "lucide-react";

export type SettingsPanelId = "hub" | "api" | "telegram" | "zalo";

const SECTIONS: {
  id: SettingsPanelId;
  title: string;
  accent: string;
  desc: string;
  icon: typeof Settings2;
  badge?: string;
}[] = [
  {
    id: "hub",
    title: "HỆ THỐNG",
    accent: "& NỀN",
    desc: "Tạm dừt poll khi tab ẩn, worker, tần suất cập nhật",
    icon: Settings2,
  },
  {
    id: "api",
    title: "NGUỒN",
    accent: "DỮ LIỆU",
    desc: "Nhóm nguồn, key thô *_raw, key sau xử lý — dùng khắp app",
    icon: Database,
  },
  {
    id: "telegram",
    title: "TELEGRAM",
    accent: "ALERTS",
    desc: "Bot, lịch gửi, gửi thử, bot trả lời",
    icon: MessageCircle,
  },
  {
    id: "zalo",
    title: "ZALO",
    accent: "OA",
    desc: "Sắp có — nhắn OA / ZNS",
    icon: Smartphone,
    badge: "Sắp ra",
  },
];

interface SettingsHubIndexProps {
  onSelect: (id: SettingsPanelId) => void;
}

export function SettingsHubIndex({ onSelect }: SettingsHubIndexProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="settings-page-title">
          CÀI ĐẶT <span className="text-[var(--accent)]">HUB</span>
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cấu hình nguồn dữ liệu, kênh nhắn tin và hành vi chạy nền. Không bắt buộc tắt app — chỉ cần đóng tab;
          tùy chọn tạm dừt poll trên trình duyệt khi không xem.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className="settings-nav-card group text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="settings-nav-icon">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="settings-nav-title">
                      {s.title} <span className="text-[var(--accent)]">{s.accent}</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{s.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)] group-hover:text-[var(--accent)]" />
              </div>
              {s.badge && (
                <span className="mt-3 inline-block rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  {s.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
