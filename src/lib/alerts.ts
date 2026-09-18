import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ALERT_ASSET_LABELS } from "./alert-constants";
import { formatVnd } from "./format";
import type { AlertAsset, PriceAlert, TriggeredAlert } from "./types";
import { sendTelegramMessage } from "./telegram";

const DATA_DIR = path.join(process.cwd(), "data");
const ALERTS_FILE = path.join(DATA_DIR, "alerts.json");
const COOLDOWN_MS = 60 * 60 * 1000;

export { ALERT_ASSET_LABELS };

interface AlertsFile {
  alerts: PriceAlert[];
}

async function readFile(): Promise<AlertsFile> {
  try {
    const raw = await fs.readFile(ALERTS_FILE, "utf-8");
    const data = JSON.parse(raw) as AlertsFile;
    return { alerts: data.alerts ?? [] };
  } catch {
    return { alerts: [] };
  }
}

async function writeFile(data: AlertsFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ALERTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function listAlerts(): Promise<PriceAlert[]> {
  const { alerts } = await readFile();
  return alerts.sort((a, b) => a.asset.localeCompare(b.asset));
}

export async function upsertAlert(
  input: Omit<PriceAlert, "id" | "createdAt" | "updatedAt" | "lastTriggeredAt" | "lastTriggeredSide"> & {
    id?: string;
  },
): Promise<PriceAlert> {
  const { alerts } = await readFile();
  const now = new Date().toISOString();

  if (input.id) {
    const idx = alerts.findIndex((a) => a.id === input.id);
    if (idx >= 0) {
      alerts[idx] = {
        ...alerts[idx],
        ...input,
        id: input.id,
        updatedAt: now,
      };
      await writeFile({ alerts });
      return alerts[idx];
    }
  }

  const alert: PriceAlert = {
    id: randomUUID(),
    asset: input.asset,
    upper: input.upper,
    lower: input.lower,
    enabled: input.enabled,
    notifyTelegram: input.notifyTelegram,
    createdAt: now,
    updatedAt: now,
    lastTriggeredAt: undefined,
    lastTriggeredSide: undefined,
  };
  alerts.push(alert);
  await writeFile({ alerts });
  return alert;
}

export async function deleteAlert(id: string): Promise<boolean> {
  const { alerts } = await readFile();
  const next = alerts.filter((a) => a.id !== id);
  if (next.length === alerts.length) return false;
  await writeFile({ alerts: next });
  return true;
}

function formatAlertValue(asset: AlertAsset, value: number): string {
  if (asset === "usdVnd") {
    return new Intl.NumberFormat("vi-VN").format(value);
  }
  if (asset === "sjcSell" || asset === "nhanSell") {
    return `${value.toFixed(2)} tr (${formatVnd(value * 1_000_000)})`;
  }
  return `$${value.toFixed(2)}`;
}

function buildAlertMessage(trigger: TriggeredAlert): string {
  const label = ALERT_ASSET_LABELS[trigger.asset];
  const side = trigger.side === "upper" ? "vượt ngưỡng trên" : "xuống dưới ngưỡng dưới";
  const threshold = formatAlertValue(trigger.asset, trigger.threshold);
  const current = formatAlertValue(trigger.asset, trigger.currentValue);
  return [
    `<b>⚠️ Cảnh báo giá — Personal Hub</b>`,
    "",
    `📌 <b>${label}</b>`,
    `Giá hiện tại: <b>${current}</b>`,
    `Đã ${side}: <b>${threshold}</b>`,
    "",
    `<i>${new Date().toLocaleString("vi-VN")}</i>`,
  ].join("\n");
}

function canTrigger(alert: PriceAlert, side: "upper" | "lower"): boolean {
  if (!alert.lastTriggeredAt || alert.lastTriggeredSide !== side) return true;
  const elapsed = Date.now() - new Date(alert.lastTriggeredAt).getTime();
  return elapsed >= COOLDOWN_MS;
}

function isInSafeZone(value: number, alert: PriceAlert): boolean {
  const aboveLower = alert.lower == null || value > alert.lower;
  const belowUpper = alert.upper == null || value < alert.upper;
  return aboveLower && belowUpper;
}

export async function evaluateAlerts(prices: Partial<Record<AlertAsset, number>>): Promise<TriggeredAlert[]> {
  const { alerts } = await readFile();
  const triggered: TriggeredAlert[] = [];
  const now = new Date().toISOString();

  for (const alert of alerts) {
    if (!alert.enabled) continue;

    const value = prices[alert.asset];
    if (value == null || Number.isNaN(value)) continue;

    if (isInSafeZone(value, alert)) {
      if (alert.lastTriggeredSide) {
        alert.lastTriggeredSide = undefined;
        alert.lastTriggeredAt = undefined;
      }
      continue;
    }

    let side: "upper" | "lower" | null = null;
    let threshold = 0;

    if (alert.upper != null && value >= alert.upper) {
      side = "upper";
      threshold = alert.upper;
    } else if (alert.lower != null && value <= alert.lower) {
      side = "lower";
      threshold = alert.lower;
    }

    if (!side || !canTrigger(alert, side)) continue;

    const event: TriggeredAlert = {
      alertId: alert.id,
      asset: alert.asset,
      side,
      threshold,
      currentValue: value,
      at: now,
    };
    triggered.push(event);

    alert.lastTriggeredAt = now;
    alert.lastTriggeredSide = side;
    alert.updatedAt = now;

    if (alert.notifyTelegram) {
      await sendTelegramMessage(buildAlertMessage(event));
    }
  }

  await writeFile({ alerts });
  return triggered;
}
