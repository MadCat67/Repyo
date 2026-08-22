import type { RepAvailabilityBlock, RepScheduleRule, RepStatus } from "@prisma/client";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "?";
}

export function isWithinAvailabilityBlock(
  at: Date,
  blocks: Pick<RepAvailabilityBlock, "startAt" | "endAt">[]
): boolean {
  const ts = at.getTime();
  return blocks.some(
    (b) => ts >= new Date(b.startAt).getTime() && ts < new Date(b.endAt).getTime()
  );
}

export function isWithinScheduleRules(
  at: Date,
  rules: Pick<RepScheduleRule, "dayOfWeek" | "startTime" | "endTime">[]
): boolean {
  if (rules.length === 0) return true;

  const day = at.getDay();
  const minutes = at.getHours() * 60 + at.getMinutes();
  const dayRules = rules.filter((r) => r.dayOfWeek === day);
  if (dayRules.length === 0) return false;

  return dayRules.some((r) => {
    const start = parseTimeToMinutes(r.startTime);
    const end = parseTimeToMinutes(r.endTime);
    return minutes >= start && minutes < end;
  });
}

export function isRepAvailableAtTime(
  at: Date,
  rules: Pick<RepScheduleRule, "dayOfWeek" | "startTime" | "endTime">[],
  blocks: Pick<RepAvailabilityBlock, "startAt" | "endAt" | "type">[],
  status: RepStatus
): boolean {
  if (status === "VACATION" || status === "OFF_DUTY") return false;
  if (isWithinAvailabilityBlock(at, blocks)) return false;
  return isWithinScheduleRules(at, rules);
}

/** Location and ETA only when rep is on-duty per schedule and real-time status. */
export function isRepLocationSharingActive(
  at: Date,
  rules: Pick<RepScheduleRule, "dayOfWeek" | "startTime" | "endTime">[],
  blocks: Pick<RepAvailabilityBlock, "startAt" | "endAt" | "type">[],
  status: RepStatus
): boolean {
  if (status !== "AVAILABLE" && status !== "BUSY") return false;
  return isRepAvailableAtTime(at, rules, blocks, status);
}

export function unavailableReason(
  at: Date,
  rules: Pick<RepScheduleRule, "dayOfWeek" | "startTime" | "endTime">[],
  blocks: Pick<RepAvailabilityBlock, "startAt" | "endAt" | "type">[],
  status: RepStatus
): string | null {
  if (status === "VACATION") return "On vacation";
  if (status === "OFF_DUTY") return "Off duty";
  if (isWithinAvailabilityBlock(at, blocks)) return "Scheduled time off";
  if (!isWithinScheduleRules(at, rules)) return "Outside available hours";
  return null;
}
