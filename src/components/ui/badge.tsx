import { cn } from "@/lib/utils";
import { REQUEST_STATUS_LABELS } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  SEARCHING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  ASSIGNED: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  PENDING: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  ACCEPTED: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  EN_ROUTE: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  ARRIVED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CANCELLED: "bg-slate-50 text-slate-500 ring-1 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-slate-50 text-slate-600"
      )}
    >
      {REQUEST_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const colors: Record<string, string> = {
    EMERGENCY: "bg-red-50 text-red-700 ring-1 ring-red-200",
    SAME_DAY: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    SCHEDULED: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
  };

  const labels: Record<string, string> = {
    EMERGENCY: "Emergency",
    SAME_DAY: "Same Day",
    SCHEDULED: "Scheduled",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[urgency] ?? "bg-slate-50"
      )}
    >
      {labels[urgency] ?? urgency}
    </span>
  );
}
