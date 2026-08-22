"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { RequestRepModal } from "@/components/provider/request-rep-modal";
import { RequestCard, type RequestData } from "@/components/shared/request-card";
import { Button } from "@/components/ui/button";
import { ApiError, connectEventSource, fetchJson } from "@/lib/api-client";
import { Plus, RefreshCw } from "lucide-react";

interface ProviderDashboardProps {
  userName: string;
  defaultFacility?: {
    name?: string;
    address?: string;
    phone?: string;
    department?: string;
    physician?: string;
    zip?: string;
  };
}

export function ProviderDashboard({ userName, defaultFacility }: ProviderDashboardProps) {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [favorites, setFavorites] = useState<{ id: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string; products: string[] }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqData, compData, favData] = await Promise.all([
        fetchJson<RequestData[]>("/api/requests"),
        fetchJson<{ id: string; name: string; products: string[] }[]>("/api/companies"),
        fetchJson<{ id: string }[]>("/api/favorites"),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setCompanies(Array.isArray(compData) ? compData : []);
      setFavorites(Array.isArray(favData) ? favData : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login?callbackUrl=/provider&error=session";
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard"
      );
      setRequests([]);
      setCompanies([]);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const es = connectEventSource("/api/notifications/stream", loadData);
    return () => es.close();
  }, [loadData]);

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

  async function handleFavorite(repId: string) {
    try {
      const isFav = favorites.some((f) => f.id === repId);
      if (isFav) {
        await fetch(`/api/favorites?repId=${repId}`, { method: "DELETE" });
      } else {
        await fetchJson("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repId }),
        });
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update favorite");
    }
  }

  const active = requests.filter(
    (r) => !["COMPLETED", "CANCELLED"].includes(r.status)
  );

  return (
    <PortalShell portal="provider" userName={userName}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            {active.length} active request{active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowModal(true)} disabled={companies.length === 0}>
            <Plus className="h-4 w-4" />
            Request a Rep
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">No active requests</p>
          <Button className="mt-4" onClick={() => setShowModal(true)} disabled={companies.length === 0}>
            Request a Rep
          </Button>
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              role="provider"
              onAction={handleAction}
              onFavorite={handleFavorite}
              isFavorite={favorites.some((f) => f.id === req.assignedRep?.id)}
            />
          ))}
        </div>
      )}

      {showModal && companies.length > 0 && (
        <RequestRepModal
          companies={companies}
          defaultFacility={defaultFacility}
          onClose={() => setShowModal(false)}
          onSuccess={loadData}
        />
      )}
    </PortalShell>
  );
}
