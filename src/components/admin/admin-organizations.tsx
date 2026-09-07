"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  status: string;
  complianceMode: string;
  contactEmail: string | null;
  baaExecutedAt: string | null;
  orgAgreementAt: string | null;
  phiEnabledAt: string | null;
  verifiedAt: string | null;
  _count: { providers: number; accessRequests: number };
  facilities: { id: string; name: string }[];
}

interface AccessLead {
  organizationName: string;
  requestCount: number;
}

export function AdminOrganizationsPage({ userName }: { userName: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [accessLeads, setAccessLeads] = useState<AccessLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{
        organizations: Organization[];
        accessLeads: AccessLead[];
      }>("/api/admin/organizations");
      setOrganizations(data.organizations ?? []);
      setAccessLeads(data.accessLeads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateOrg(id: string, patch: Record<string, unknown>) {
    try {
      await fetchJson(`/api/admin/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <PortalShell portal="admin" userName={userName}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Provider Organizations</h1>
        <p className="text-sm text-slate-600">
          Manage BAA status, PHI enablement, and organization verification
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {accessLeads.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Access request leads</h2>
          <p className="mt-1 text-sm text-amber-900">
            Healthcare workers requesting GoRepYo before their organization is activated
          </p>
          <ul className="mt-4 space-y-2">
            {accessLeads.map((lead) => (
              <li
                key={lead.organizationName}
                className="flex items-center justify-between rounded-lg bg-white/80 px-4 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{lead.organizationName}</span>
                <span className="text-amber-800">
                  {lead.requestCount} user{lead.requestCount !== 1 ? "s" : ""} requested access
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="text-slate-500">Loading organizations...</p>
      ) : (
        <div className="space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{org.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {org._count.providers} providers · {org._count.accessRequests} access requests ·{" "}
                    {org.facilities.length} facilities
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      org.status === "ACTIVATED"
                        ? "bg-emerald-50 text-emerald-700"
                        : org.status === "VERIFIED"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {org.status}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      org.complianceMode === "PHI_ENABLED"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {org.complianceMode === "PHI_ENABLED" ? "PHI Enabled" : "Standard"}
                  </span>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">BAA executed</dt>
                  <dd>{org.baaExecutedAt ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Org agreement</dt>
                  <dd>{org.orgAgreementAt ? "Yes" : "No"}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {org.status === "PENDING" && (
                  <Button size="sm" variant="secondary" onClick={() => updateOrg(org.id, { status: "VERIFIED" })}>
                    Mark Verified
                  </Button>
                )}
                {!org.baaExecutedAt && (
                  <Button size="sm" variant="secondary" onClick={() => updateOrg(org.id, { baaExecuted: true })}>
                    Record BAA
                  </Button>
                )}
                {!org.orgAgreementAt && (
                  <Button size="sm" variant="secondary" onClick={() => updateOrg(org.id, { orgAgreement: true })}>
                    Record Enterprise Agreement
                  </Button>
                )}
                {org.complianceMode !== "PHI_ENABLED" && (
                  <Button size="sm" onClick={() => updateOrg(org.id, { phiEnabled: true })}>
                    Enable PHI
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
