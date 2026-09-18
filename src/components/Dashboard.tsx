"use client";

import { useEffect, useState } from "react";
import { Clock, Menu } from "lucide-react";
import { Sidebar, type TabId } from "./Sidebar";
import { MarketPanel } from "./MarketPanel";
import { NewsPanel } from "./NewsPanel";
import { GitHubPanel } from "./GitHubPanel";
import { SettingsPanel } from "./settings/SettingsPanel";
import type { SettingsPanelId } from "./settings/SettingsHubIndex";
import { Card } from "./Card";

const HOME_CARDS: { id: TabId; title: string; desc: string }[] = [
  { id: "market", title: "Thị trường", desc: "Vàng SJC, bạc, USD/VND, biểu đồ zoom, cảnh báo giá" },
  { id: "news", title: "Tin tức", desc: "RSS đa nguồn, lọc chủ đề và từ khóa" },
  { id: "github", title: "GitHub Trending", desc: "Repo hot theo ngôn ngữ và thời gian" },
  { id: "settings", title: "Cài đặt", desc: "API, Telegram, Zalo, tạm dừt khi không dùng tab" },
];

const VALID_TABS: TabId[] = ["home", "market", "news", "github", "settings"];

const SIDEBAR_COLLAPSED_KEY = "ph-sidebar-collapsed";

function readTabFromUrl(): TabId {
  if (typeof window === "undefined") return "home";
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  if (t === "telegram") return "settings";
  return (VALID_TABS as string[]).includes(t ?? "") ? (t as TabId) : "home";
}

function readSettingsPanelFromUrl(): SettingsPanelId | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("tab") === "telegram") return "telegram";
  const p = params.get("panel");
  const valid: SettingsPanelId[] = ["hub", "api", "telegram", "zalo"];
  return valid.includes(p as SettingsPanelId) ? (p as SettingsPanelId) : null;
}

export function Dashboard() {
  const [tab, setTab] = useState<TabId>("home");
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanelId | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(readTabFromUrl());
    setSettingsPanel(readSettingsPanelFromUrl());
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    const onPop = () => {
      setTab(readTabFromUrl());
      setSettingsPanel(readSettingsPanelFromUrl());
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearInterval(id);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (sidebarCollapsed === null) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const navigate = (t: TabId) => {
    setTab(t);
    setMobileNav(false);
    if (t !== "settings") setSettingsPanel(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (t === "home") {
        url.searchParams.delete("tab");
        url.searchParams.delete("panel");
      } else {
        url.searchParams.set("tab", t);
        if (t !== "settings") url.searchParams.delete("panel");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  const onSettingsPanelChange = (panel: SettingsPanelId | null) => {
    setSettingsPanel(panel);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "settings");
      if (panel) url.searchParams.set("panel", panel);
      else url.searchParams.delete("panel");
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={tab}
        onChange={navigate}
        mobileOpen={mobileNav}
        onMobileClose={() => setMobileNav(false)}
        desktopCollapsed={Boolean(sidebarCollapsed)}
        onDesktopCollapsedChange={(v) => setSidebarCollapsed(v)}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-0">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/80 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="btn-secondary p-2 lg:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
                Bảng tin cá nhân
              </p>
              <h2 className="truncate text-lg font-semibold">{tabTitle(tab, settingsPanel)}</h2>
            </div>
          </div>
          <div
            className="hidden shrink-0 items-center gap-2 text-sm text-[var(--muted)] sm:flex"
            suppressHydrationWarning
          >
            <Clock className="h-4 w-4" />
            <span suppressHydrationWarning>
              {now
                ? now.toLocaleString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : ""}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "home" && <HomeView onNavigate={navigate} />}
          {tab === "market" && <MarketPanel />}
          {tab === "news" && <NewsPanel />}
          {tab === "github" && <GitHubPanel />}
          {tab === "settings" && (
            <SettingsPanel panel={settingsPanel} onPanelChange={onSettingsPanelChange} />
          )}
        </div>
      </main>
    </div>
  );
}

function tabTitle(tab: TabId, settingsPanel: SettingsPanelId | null): string {
  const map: Record<TabId, string> = {
    home: "Tổng quan",
    market: "Thị trường vàng, bạc & USD",
    news: "Tin tức",
    github: "GitHub Trending",
    settings: "Cài đặt",
  };
  if (tab === "settings" && settingsPanel) {
    const sub: Record<SettingsPanelId, string> = {
      hub: "Hệ thống & nền",
      api: "Nguồn dữ liệu",
      telegram: "Telegram",
      zalo: "Zalo",
    };
    return `${map.settings} · ${sub[settingsPanel]}`;
  }
  return map[tab];
}

function HomeView({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  return (
    <div className="space-y-6">
      <Card title="Chào bạn 👋" subtitle="Personal Hub — chạy local, không public host">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Theo dõi vàng SJC, bạc, tỷ giá USD, tin RSS, GitHub trending và Telegram. Dữ liệu biểu đồ
          lưu tại <code className="text-[var(--accent)]">data/price-history.json</code> trên máy bạn.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {HOME_CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onNavigate(c.id)}
            className="stat-card group text-left transition hover:border-[var(--accent)]/40"
          >
            <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
              {c.title}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
