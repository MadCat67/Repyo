"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { RequestCard, type RequestData } from "@/components/shared/request-card";
import { Button } from "@/components/ui/button";
import { connectEventSource, fetchJson } from "@/lib/api-client";
import { REP_STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow } from "date-fns";

const REP_STATUSES = ["AVAILABLE", "BUSY", "OFF_DUTY", "VACATION"] as const;

export function RepDashboard({ userName }: { userName: string }) {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [status, setStatus] = useState("OFF_DUTY");
  const [onCall, setOnCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqData, profile] = await Promise.all([
        fetchJson<RequestData[]>("/api/requests"),
        fetchJson<{ status?: string; onCallEnabled?: boolean } | null>("/api/rep/profile"),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      if (profile?.status) setStatus(profile.status);
      if (profile?.onCallEnabled != null) setOnCall(profile.onCallEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const es = connectEventSource("/api/notifications/stream", loadData);
    return () => es.close();
  }, [loadData]);

  async function updateStatus(newStatus: string) {
    try {
      await fetchJson("/api/rep/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function toggleOnCall() {
    try {
      const next = !onCall;
      await fetchJson("/api/rep/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onCallEnabled: next }),
      });
      setOnCall(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update on-call status");
    }
  }

  async function handleAction(action: string, requestId: string) {
    try {
      await fetchJson(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const pending = requests.filter((r) =>
    ["ASSIGNED", "PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED"].includes(r.status)
  );
  const urgent = pending.filter((r) => r.urgency === "EMERGENCY");

  return (
    <PortalShell portal="rep" userName={userName}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Rep Dashboard</h1>
        <p className="text-sm text-slate-600">
          {pending.length} pending · {urgent.length} urgent
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">Your Status</p>
          <div className="flex flex-wrap gap-2">
            {REP_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  status === s ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {REP_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">On-Call Schedule</p>
          <button
            onClick={toggleOnCall}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              onCall ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
            )}
          >
            {onCall ? "On Call — Active" : "Off Call"}
          </button>
        </div>
      </div>

      {urgent.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-red-600">Urgent Requests</h2>
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            {urgent.map((req) => (
              <RequestCard key={req.id} request={req} role="rep" onAction={handleAction} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Pending Requests</h2>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">No pending requests</p>
            <Button className="mt-3" variant="secondary" onClick={() => updateStatus("AVAILABLE")}>
              Go Available
            </Button>
          </div>
        ) : (
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            {pending.map((req) => (
              <RequestCard key={req.id} request={req} role="rep" onAction={handleAction} />
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}

export function RepSchedulePage({ userName }: { userName: string }) {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [onCall, setOnCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [reqData, profile] = await Promise.all([
          fetchJson<RequestData[]>("/api/requests"),
          fetchJson<{ onCallEnabled?: boolean } | null>("/api/rep/profile"),
        ]);
        setRequests(Array.isArray(reqData) ? reqData : []);
        setOnCall(profile?.onCallEnabled ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedule");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleOnCall() {
    try {
      const next = !onCall;
      await fetchJson("/api/rep/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onCallEnabled: next }),
      });
      setOnCall(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update on-call status");
    }
  }

  const scheduled = requests
    .filter((r) => !["CANCELLED"].includes(r.status))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  function dayLabel(date: string) {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEEE, MMM d");
  }

  const grouped = scheduled.reduce<Record<string, RequestData[]>>((acc, req) => {
    const key = dayLabel(req.scheduledAt);
    (acc[key] ??= []).push(req);
    return acc;
  }, {});

  return (
    <PortalShell portal="rep" userName={userName}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-600">{scheduled.length} upcoming cases</p>
        </div>
        <button
          onClick={toggleOnCall}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            onCall ? "bg-rose-600 text-white" : "bg-white ring-1 ring-slate-200 text-slate-700"
          )}
        >
          {onCall ? "On Call" : "Off Call"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">No scheduled cases</p>
        </div>
      ) : (
        Object.entries(grouped).map(([day, dayRequests]) => (
          <section key={day} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase text-rose-600">{day}</h2>
            <div className="grid gap-3">
              {dayRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-medium text-slate-900">{req.facilityName}</p>
                    <p className="text-sm text-slate-600">{req.procedureType}</p>
                    <p className="text-xs text-slate-500">{format(new Date(req.scheduledAt), "h:mm a")}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {req.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </PortalShell>
  );
}
