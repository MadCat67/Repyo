"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DomainTagInput } from "@/components/shared/domain-tag-input";
import { fetchJson } from "@/lib/api-client";
import { VERIFICATION_METHOD_LABELS, VERIFICATION_METHODS } from "@/lib/verification/constants";

type CompanyVerificationConfig = {
  id: string;
  name: string;
  userVerificationMethod: string;
  approvedEmailDomains: string[];
};

type PendingMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  accountState: string;
};

export function CompanyVerificationPanel() {
  const [config, setConfig] = useState<CompanyVerificationConfig | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cfg, members] = await Promise.all([
        fetchJson<CompanyVerificationConfig>("/api/company/config"),
        fetchJson<{ pending: PendingMember[] }>("/api/company/members"),
      ]);
      setConfig(cfg);
      setDomains(cfg.approvedEmailDomains ?? []);
      setPending(members.pending ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveVerification() {
    if (!config) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchJson("/api/company/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userVerificationMethod: config.userVerificationMethod,
          approvedEmailDomains: domains,
        }),
      });
      setMessage("Invite and verification settings saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function approveUser(userId: string) {
    try {
      await fetchJson("/api/company/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "approve" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve user");
    }
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Loading verification settings...</p>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Invites & Verification</h2>
        <p className="mt-1 text-sm text-slate-600">
          Control which email domains can join from invitations and whether new
          users need your manual approval.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Verification policy
            </span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={config.userVerificationMethod}
              onChange={(e) =>
                setConfig({ ...config, userVerificationMethod: e.target.value })
              }
            >
              {VERIFICATION_METHODS.map((method) => (
                <option key={method} value={method}>
                  {VERIFICATION_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </label>

          <DomainTagInput
            label="Approved email domains"
            domains={domains}
            onChange={setDomains}
            helperText="Invited users must sign up with one of these domains."
          />
        </div>

        <Button className="mt-5" disabled={saving} onClick={saveVerification}>
          {saving ? "Saving..." : "Save Verification Settings"}
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
          <h2 className="font-semibold text-slate-900">Pending approval</h2>
          <p className="mt-1 text-sm text-slate-600">
            These users confirmed their email but are waiting for you to approve
            them.
          </p>
          <ul className="mt-4 space-y-2">
            {pending.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-slate-600">
                    {member.email} · {member.role}
                  </p>
                </div>
                <Button size="sm" onClick={() => approveUser(member.id)}>
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
