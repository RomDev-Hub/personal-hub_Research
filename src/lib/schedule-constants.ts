import type { ScheduleAction } from "./types";

export const SCHEDULE_ACTION_LABELS: Record<ScheduleAction, string> = {
  digest: "Bản tin thị trường",
  market: "Giá vàng, bạc, USD chi tiết",
  custom: "Tin nhắn tùy chỉnh",
};

export const WEEKDAY_LABELS = [
  { value: 0, label: "CN" },
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
];
