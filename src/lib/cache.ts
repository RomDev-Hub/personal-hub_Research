import { promises as fs } from "fs";
import path from "path";
import type { HistoryPoint } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "price-history.json");
const MAX_POINTS = 2160;

export async function appendHistory(point: Omit<HistoryPoint, "timestamp">): Promise<HistoryPoint[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  let history: HistoryPoint[] = [];
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    history = JSON.parse(raw) as HistoryPoint[];
  } catch {
    history = [];
  }

  const entry: HistoryPoint = {
    timestamp: new Date().toISOString(),
    ...point,
  };

  history.push(entry);
  if (history.length > MAX_POINTS) {
    history = history.slice(-MAX_POINTS);
  }

  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
  return history;
}

export async function readHistory(): Promise<HistoryPoint[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as HistoryPoint[];
  } catch {
    return [];
  }
}
