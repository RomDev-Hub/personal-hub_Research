/** UI preferences — lưu localStorage trên trình duyệt (không thay .env). */

export interface HubUiSettings {
  /** Tạm dừng poll thị trường + refresh Telegram trên trình duyệt khi tab ẩn / cửa sổ thu nhỏ. */
  pauseBrowserWorkWhenHidden: boolean;
}

const STORAGE_KEY = "personal-hub-ui-settings";

const DEFAULTS: HubUiSettings = {
  pauseBrowserWorkWhenHidden: true,
};

export function loadHubUiSettings(): HubUiSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<HubUiSettings>;
    return {
      pauseBrowserWorkWhenHidden:
        typeof parsed.pauseBrowserWorkWhenHidden === "boolean"
          ? parsed.pauseBrowserWorkWhenHidden
          : DEFAULTS.pauseBrowserWorkWhenHidden,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveHubUiSettings(next: HubUiSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("hub-ui-settings"));
}

export function patchHubUiSettings(patch: Partial<HubUiSettings>): HubUiSettings {
  const merged = { ...loadHubUiSettings(), ...patch };
  saveHubUiSettings(merged);
  return merged;
}
