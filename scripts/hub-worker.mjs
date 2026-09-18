#!/usr/bin/env node
/**
 * Personal Hub — worker nền: lịch gửi + bot Telegram trả lời
 * Gọi /api/hub/tick mỗi 45 giây (cần Next.js đang chạy)
 */
const HUB_URL = process.env.HUB_URL ?? "http://127.0.0.1:3000";
const INTERVAL_MS = Number(process.env.HUB_TICK_MS ?? 45_000);
const SECRET = process.env.HUB_CRON_SECRET?.trim();

async function tick() {
  const headers = { "Content-Type": "application/json" };
  if (SECRET) headers["x-hub-secret"] = SECRET;

  try {
    const res = await fetch(`${HUB_URL}/api/hub/tick`, { method: "POST", headers });
    if (!res.ok) {
      console.warn(`[hub-worker] tick HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    const ran = data.schedulesRan?.length ?? 0;
    const replied = data.telegram?.replied ?? 0;
    if (ran || replied) {
      console.log(`[hub-worker] ${new Date().toLocaleTimeString("vi-VN")} lịch=${ran} trả lời=${replied}`);
    }
  } catch (e) {
    console.warn("[hub-worker] chờ server...", e instanceof Error ? e.message : e);
  }
}

console.log(`[hub-worker] Personal Hub → ${HUB_URL} (mỗi ${INTERVAL_MS / 1000}s)`);
await tick();
setInterval(tick, INTERVAL_MS);
