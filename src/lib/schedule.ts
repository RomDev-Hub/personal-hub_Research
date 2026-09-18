import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { ScheduleJob } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");

interface SchedulesFile {
  jobs: ScheduleJob[];
}

async function readFile(): Promise<SchedulesFile> {
  try {
    const raw = await fs.readFile(SCHEDULES_FILE, "utf-8");
    return JSON.parse(raw) as SchedulesFile;
  } catch {
    return { jobs: [] };
  }
}

async function writeFile(data: SchedulesFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SCHEDULES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function listSchedules(): Promise<ScheduleJob[]> {
  const { jobs } = await readFile();
  return jobs.sort((a, b) => a.time.localeCompare(b.time));
}

export async function upsertSchedule(
  input: Omit<
    ScheduleJob,
    "id" | "createdAt" | "updatedAt" | "lastRunDate" | "enabled"
  > &
    Partial<Pick<ScheduleJob, "lastRunDate" | "enabled">> & { id?: string },
): Promise<ScheduleJob> {
  const { jobs } = await readFile();
  const now = new Date().toISOString();

  if (input.id) {
    const idx = jobs.findIndex((j) => j.id === input.id);
    if (idx >= 0) {
      const prev = jobs[idx];
      const merged: ScheduleJob = {
        ...prev,
        name: input.name,
        time: input.time,
        days: input.days ?? prev.days,
        action: input.action,
        customMessage:
          input.action === "custom" ? (input.customMessage?.trim() ?? prev.customMessage) : undefined,
        enabled: typeof input.enabled === "boolean" ? input.enabled : prev.enabled,
        id: input.id,
        createdAt: prev.createdAt,
        updatedAt: now,
        lastRunDate:
          typeof input.lastRunDate !== "undefined" ? input.lastRunDate : prev.lastRunDate,
      };
      jobs[idx] = merged;
      await writeFile({ jobs });
      return merged;
    }
  }

  const job: ScheduleJob = {
    id: randomUUID(),
    name: input.name,
    time: input.time,
    days: input.days,
    action: input.action,
    customMessage: input.customMessage,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  jobs.push(job);
  await writeFile({ jobs });
  return job;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const { jobs } = await readFile();
  const next = jobs.filter((j) => j.id !== id);
  if (next.length === jobs.length) return false;
  await writeFile({ jobs: next });
  return true;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayMatches(job: ScheduleJob): boolean {
  if (!job.days.length) return true;
  return job.days.includes(new Date().getDay());
}

export async function getDueSchedules(): Promise<ScheduleJob[]> {
  const jobs = await listSchedules();
  const hm = currentHm();
  const dateKey = todayKey();

  return jobs.filter((job) => {
    if (!job.enabled) return false;
    if (!dayMatches(job)) return false;
    if (job.time !== hm) return false;
    if (job.lastRunDate === dateKey) return false;
    return true;
  });
}

export async function markScheduleRan(id: string): Promise<void> {
  const { jobs } = await readFile();
  const dateKey = todayKey();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return;
  jobs[idx].lastRunDate = dateKey;
  jobs[idx].updatedAt = new Date().toISOString();
  await writeFile({ jobs });
}

export { SCHEDULE_ACTION_LABELS } from "./schedule-constants";
