"use client";

import { StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPipeline } from "@/components/shared/status-pipeline";
import { format } from "date-fns";
import { Heart, MapPin, Phone, User, X } from "lucide-react";
import { useState } from "react";

export interface RequestData {
  id: string;
  facilityName: string;
  facilityAddr?: string;
  facilityZipCode?: string | null;
  procedureType: string;
  urgency: string;
  status: string;
  scheduledAt: string;
  department?: string;
  physicianName?: string;
  notes?: string | null;
  repLat?: number | null;
  repLng?: number | null;
  etaMinutes?: number | null;
  assignedRep?: { id: string; name: string; phone: string | null } | null;
  assignedAdmin?: { id: string; name: string } | null;
  provider?: { id: string; name: string; phone: string | null } | null;
  initiatedByRep?: { id: string; name: string; phone: string | null } | null;
  requesterName?: string | null;
  company?: { name: string } | null;
  statusLogs?: { status: string; createdAt: string; note?: string | null }[];
}

interface RepOption {
  id: string;
  name: string;
}

export function RequestCard({
  request,
  onAction,
  onAssignRep,
  onFavorite,
  isFavorite,
  role,
  showPipeline = false,
  availableReps = [],
}: {
  request: RequestData;
  onAction?: (action: string, requestId: string) => void;
  onAssignRep?: (requestId: string, repId: string) => void;
  onFavorite?: (repId: string) => void;
  isFavorite?: boolean;
  role: "provider" | "rep" | "company";
  showPipeline?: boolean;
  availableReps?: RepOption[];
}) {
  const [expanded, setExpanded] = useState(showPipeline);
  const [selectedRepId, setSelectedRepId] = useState("");

  const canManageAsAdmin = role === "company";

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{request.facilityName}</h3>
              <UrgencyBadge urgency={request.urgency} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{request.procedureType}</p>
            {request.facilityZipCode && (
              <p className="text-xs text-slate-500">Zip {request.facilityZipCode}</p>
            )}
            {role === "company" && request.provider && (
              <p className="text-xs text-slate-500">
                Provider: {request.provider.name}
              </p>
            )}
            {!request.provider && request.initiatedByRep && (
              <p className="text-xs text-slate-500">
                Created by rep: {request.initiatedByRep.name}
              </p>
            )}
            {request.requesterName && (
              <p className="text-xs text-slate-500">
                Requester: {request.requesterName}
              </p>
            )}
            {role !== "company" && request.company && (
              <p className="text-xs text-slate-500">{request.company.name}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {format(new Date(request.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {(expanded || showPipeline) && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <StatusPipeline currentStatus={request.status} />
            {request.department && (
              <p className="mt-2 text-xs text-slate-500">
                {request.department}
                {request.physicianName ? ` · ${request.physicianName}` : ""}
              </p>
            )}
            {request.notes && (
              <p className="mt-2 text-sm text-slate-600">{request.notes}</p>
            )}
          </div>
        )}

        {canManageAsAdmin && request.status === "REQUESTING" && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            New request — accept and assign a rep
          </div>
        )}

        {request.assignedRep && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <span className="font-medium">{request.assignedRep.name}</span>
            </div>
            {request.assignedRep.phone && (
              <a
                href={`tel:${request.assignedRep.phone}`}
                className="flex items-center gap-1 text-rose-600 hover:underline"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            )}
            {request.etaMinutes != null &&
              request.repLat != null &&
              request.status === "EN_ROUTE" && (
              <span className="flex items-center gap-1 text-slate-500">
                <MapPin className="h-4 w-4" />
                ETA {request.etaMinutes} min
              </span>
            )}
            {role === "provider" && onFavorite && request.assignedRep && (
              <button
                onClick={() => onFavorite(request.assignedRep!.id)}
                className="flex items-center gap-1 text-rose-500 hover:text-rose-700"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? "fill-rose-500" : ""}`} />
                {isFavorite ? "Favorited" : "Favorite"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {!showPipeline && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide" : "Track"} Status
          </Button>
        )}

        {canManageAsAdmin && request.status === "REQUESTING" && onAction && (
          <Button size="sm" onClick={() => onAction("ACCEPTED", request.id)}>
            Accept
          </Button>
        )}

        {canManageAsAdmin &&
          ["REQUESTING", "ACCEPTED"].includes(request.status) &&
          onAssignRep &&
          availableReps.length > 0 && (
            <>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              >
                <option value="">Assign rep...</option>
                {availableReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedRepId}
                onClick={() => {
                  if (selectedRepId) onAssignRep(request.id, selectedRepId);
                }}
              >
                Assign
              </Button>
            </>
          )}

        {role === "rep" &&
          request.assignedRep &&
          request.status === "ACCEPTED" &&
          onAction && (
            <Button size="sm" onClick={() => onAction("EN_ROUTE", request.id)}>
              Mark En Route
            </Button>
          )}

        {role === "rep" && request.status === "EN_ROUTE" && onAction && (
          <Button size="sm" onClick={() => onAction("ARRIVED", request.id)}>
            Mark Arrived
          </Button>
        )}

        {role === "rep" && request.status === "ARRIVED" && onAction && (
          <Button size="sm" onClick={() => onAction("COMPLETED", request.id)}>
            Complete Request
          </Button>
        )}

        {role === "provider" &&
          !["COMPLETED", "CANCELLED"].includes(request.status) &&
          onAction && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("CANCELLED", request.id)}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
      </div>
    </div>
  );
}
