"use client";

import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  GitBranch,
  Home,
  Newspaper,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";

export type TabId = "home" | "market" | "news" | "github" | "settings";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Tổng quan", icon: Home },
  { id: "market", label: "Thị trường", icon: TrendingUp },
  { id: "news", label: "Tin tức", icon: Newspaper },
  { id: "github", label: "GitHub Trending", icon: GitBranch },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

interface SidebarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Thu gọn menu trái (chỉ icon) trên desktop lg+ */
  desktopCollapsed?: boolean;
  onDesktopCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  active,
  onChange,
  mobileOpen,
  onMobileClose,
  desktopCollapsed = false,
  onDesktopCollapsedChange,
}: SidebarProps) {
  const pick = (id: TabId) => {
    onChange(id);
    onMobileClose?.();
  };

  const nav = (
    <>
      <div className={`border-b border-[var(--border)] p-6 ${desktopCollapsed ? "lg:p-3" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <SidebarBrand collapsed={desktopCollapsed} />
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="btn-secondary p-2 lg:hidden"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      <nav className={`flex flex-1 flex-col gap-1 p-3 ${desktopCollapsed ? "lg:px-1 lg:py-2" : ""}`}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            title={label}
            className={`flex items-center gap-3 rounded-xl py-3 text-left text-sm font-medium transition ${
              desktopCollapsed ? "lg:justify-center lg:px-0 lg:py-3" : "px-4"
            } ${
              active === id
                ? "bg-[var(--accent)] text-black shadow-lg shadow-amber-900/25"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className={`truncate ${desktopCollapsed ? "lg:sr-only" : ""}`}>{label}</span>
          </button>
        ))}
      </nav>
      <SidebarFooter
        collapsed={desktopCollapsed}
        onToggleCollapse={
          onDesktopCollapsedChange ? () => onDesktopCollapsedChange(!desktopCollapsed) : undefined
        }
      />
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Đóng menu"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl transition-[width,transform] duration-200 lg:static lg:z-auto lg:max-w-none lg:shrink-0 lg:translate-x-0 ${
          desktopCollapsed ? "lg:w-[4.25rem]" : "lg:w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {nav}
      </aside>
    </>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${collapsed ? "lg:justify-center lg:w-full" : ""}`}>
      <BarChart3 className="h-8 w-8 shrink-0 text-[var(--accent)]" />
      <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
        <h1 className="text-lg font-bold tracking-tight">Personal Hub</h1>
        <p className="text-xs text-[var(--muted)]">Bảng tin cá nhân</p>
      </div>
    </div>
  );
}

function SidebarFooter({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted)]">
      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`mb-3 hidden w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/20 py-2 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] lg:flex ${
            collapsed ? "px-2" : "px-3"
          }`}
          title={collapsed ? "Mở rộng menu" : "Thu gọn chỉ hiện icon"}
        >
          {collapsed ? (
            <>
              <ChevronsRight className="h-4 w-4 shrink-0" />
              <span className="sr-only">Mở rộng menu</span>
            </>
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Thu gọn</span>
            </>
          )}
        </button>
      ) : null}
      <p className={`font-medium text-[var(--foreground)] ${collapsed ? "lg:hidden" : ""}`}>Chạy local</p>
      <p className={`mt-1 ${collapsed ? "lg:hidden" : ""}`}>Không public host — chỉ máy bạn.</p>
    </div>
  );
}
