import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Haversine distance in miles between two lat/lng points */
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Rough ETA in minutes assuming average 35 mph */
export function estimateEtaMinutes(distanceMi: number): number {
  return Math.max(1, Math.round((distanceMi / 35) * 60));
}

export const PROCEDURE_TYPES = [
  "PPM",
  "ICD",
  "CRT",
  "Extraction",
  "Loop",
  "EP Study",
  "Ablation",
  "Watchman",
  "Structural Heart",
  "Leadless PPM",
  "CRT-D",
  "CRT-P",
  "Other",
] as const;

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  SEARCHING: "Searching",
  ASSIGNED: "Assigned",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  EN_ROUTE: "En Route",
  ARRIVED: "Arrived",
  COMPLETED: "Complete",
  CANCELLED: "Cancelled",
};

export const REP_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  OFF_DUTY: "Off Duty",
  VACATION: "Vacation",
};
