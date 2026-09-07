"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Copy, Check, Mail, MessageSquare, Link2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InvitationChannel } from "@prisma/client";

type InviteResult = {
  id: string;
  inviteUrl: string;
  expiresAt: string;
  deliveryNote?: string | null;
};

const CHANNELS: { id: InvitationChannel; label: string; icon: typeof Mail }[] = [
  { id: "EMAIL", label: "Email", icon: Mail },
  { id: "SMS", label: "SMS", icon: MessageSquare },
  { id: "LINK", label: "Link", icon: Link2 },
  { id: "QR", label: "QR code", icon: QrCode },
];

export function InviteModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<InvitationChannel>("LINK");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<
    {
      id: string;
      inviteUrl: string;
      inviteeEmail: string | null;
      status: string;
      expiresAt: string;
    }[]
  >([]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations");
      if (res.ok) {
        const data = await res.json();
        setRecent(Array.isArray(data) ? data : []);
      }
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function createInvite() {
    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          inviteeEmail: channel === "EMAIL" ? email : undefined,
          inviteePhone: channel === "SMS" ? phone : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create invitation");
        return;
      }
      setResult(data);
      loadRecent();
    } catch {
      setError("Failed to create invitation");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revokeInvite(id: string) {
    const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    if (res.ok) loadRecent();
  }

  const needsContact = channel === "EMAIL" || channel === "SMS";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Invite to RepYo</h2>
            <p className="text-xs text-slate-500">
              Invitations never include patient information. Verification still applies after signup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setChannel(id);
                  setResult(null);
                  setError("");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  channel === id
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {channel === "EMAIL" && (
            <Input
              label="Colleague's email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@hospital.org"
            />
          )}

          {channel === "SMS" && (
            <Input
              label="Colleague's phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 555-5555"
            />
          )}

          {(channel === "LINK" || channel === "QR") && (
            <p className="text-sm text-slate-600">
              Generate a single-use link{channel === "QR" ? " and QR code" : ""} you can share with a colleague.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <Button
            onClick={createInvite}
            disabled={loading || (needsContact && channel === "EMAIL" && !email.trim()) || (needsContact && channel === "SMS" && !phone.trim())}
            className="w-full"
          >
            {loading ? "Creating..." : "Create invitation"}
          </Button>

          {result && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              {result.deliveryNote && (
                <p className="text-xs text-emerald-800">{result.deliveryNote}</p>
              )}
              <div className="flex gap-2">
                <input
                  readOnly
                  value={result.inviteUrl}
                  className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(result.inviteUrl)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {channel === "QR" && (
                <div className="flex justify-center pt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(result.inviteUrl)}`}
                    alt="Invitation QR code"
                    width={180}
                    height={180}
                    className="rounded-lg border border-emerald-200 bg-white p-2"
                  />
                </div>
              )}
              <p className="text-xs text-emerald-700">
                Expires {new Date(result.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}

          {recent.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your recent invitations
              </p>
              <ul className="space-y-2">
                {recent.slice(0, 5).map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {inv.inviteeEmail ?? "Shareable link"}
                      </p>
                      <p className="text-slate-500">
                        {inv.status} · expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(inv.inviteUrl)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {inv.status === "PENDING" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => revokeInvite(inv.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
