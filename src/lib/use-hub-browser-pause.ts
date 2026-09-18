"use client";

import { useEffect, useState } from "react";
import { loadHubUiSettings } from "./hub-settings";

/** true khi nên tạm dừt poll/tick phía trình duyệt (tab ẩn + user bật tùy chọn). */
export function useHubBrowserPause(): boolean {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const sync = () => {
      const { pauseBrowserWorkWhenHidden } = loadHubUiSettings();
      setPaused(pauseBrowserWorkWhenHidden && document.hidden);
    };
    sync();
    const onVis = () => sync();
    const onSettings = () => sync();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("hub-ui-settings", onSettings);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("hub-ui-settings", onSettings);
    };
  }, []);

  return paused;
}
