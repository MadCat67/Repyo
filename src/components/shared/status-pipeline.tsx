"use client";

import { REQUEST_STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PIPELINE = [
  "REQUESTING",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "COMPLETED",
] as const;

export function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === "CANCELLED") {
    return (
      <p className="text-sm text-slate-500">This request was cancelled.</p>
    );
  }

  const currentIdx = PIPELINE.indexOf(currentStatus as (typeof PIPELINE)[number]);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {PIPELINE.map((status, idx) => {
        const done = currentIdx >= 0 && idx <= currentIdx;
        const active = status === currentStatus;

        return (
          <div key={status} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                  done
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {done && idx < currentIdx ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1 hidden whitespace-nowrap text-[10px] sm:block",
                  active ? "font-semibold text-rose-600" : "text-slate-500"
                )}
              >
                {REQUEST_STATUS_LABELS[status]}
              </span>
            </div>
            {idx < PIPELINE.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-6 sm:w-10",
                  done && idx < currentIdx ? "bg-rose-400" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
