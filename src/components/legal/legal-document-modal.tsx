"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function LegalDocumentModal({
  slug,
  open,
  onClose,
}: {
  slug: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<{
    title: string;
    version: string;
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !slug) return;
    setLoading(true);
    fetch(`/api/legal/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDoc(data))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [open, slug]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className={cn(
          "relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl",
          "border border-slate-200 bg-white shadow-xl"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {doc?.title ?? "Loading..."}
            </h2>
            {doc?.version && (
              <p className="text-xs text-slate-500">Version {doc.version}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading document...</p>
          ) : doc ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
              {doc.content.replace(/^#+\s/gm, "").trim()}
            </pre>
          ) : (
            <p className="text-sm text-red-600">Could not load document.</p>
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-3 flex gap-2">
          {slug && (
            <a
              href={`/legal/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open in new tab
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DocLink({
  slug,
  children,
  onOpen,
}: {
  slug: string;
  children: React.ReactNode;
  onOpen: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(slug)}
      className="font-medium text-rose-600 underline hover:text-rose-700"
    >
      {children}
    </button>
  );
}

export function ProviderAgreementSection({
  acceptAuthorization,
  acceptPrivacy,
  onAcceptAuthorization,
  onAcceptPrivacy,
  onOpenDocument,
}: {
  acceptAuthorization: boolean;
  acceptPrivacy: boolean;
  onAcceptAuthorization: (v: boolean) => void;
  onAcceptPrivacy: (v: boolean) => void;
  onOpenDocument: (slug: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Account Agreement
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Read each document before accepting. Account creation requires all
          agreements below.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acceptAuthorization}
          onChange={(e) => onAcceptAuthorization(e.target.checked)}
          className="mt-1"
          required
        />
        <span>
          I confirm that I am authorized by the healthcare organization identified
          above to use RepYo. I have read and agree to the{" "}
          <DocLink slug="provider-user-agreement" onOpen={onOpenDocument}>
            RepYo Healthcare Provider User Agreement
          </DocLink>{" "}
          and{" "}
          <DocLink slug="phi-security-requirements" onOpen={onOpenDocument}>
            PHI, Privacy &amp; Security Requirements
          </DocLink>
          , and acknowledge that I am responsible for entering, accessing, and
          sharing patient information only as authorized and reasonably necessary
          for legitimate professional purposes.
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acceptPrivacy}
          onChange={(e) => onAcceptPrivacy(e.target.checked)}
          className="mt-1"
          required
        />
        <span>
          I acknowledge the{" "}
          <DocLink slug="privacy-policy" onOpen={onOpenDocument}>
            RepYo Privacy Policy
          </DocLink>{" "}
          and{" "}
          <DocLink slug="terms-of-use" onOpen={onOpenDocument}>
            Terms of Use
          </DocLink>{" "}
          and consent to electronic service, security, scheduling, and request
          notifications.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-slate-500">
        By creating an account, you understand that RepYo is a
        representative-support request and scheduling platform. RepYo is not an
        emergency service, electronic health record, or substitute for your
        organization&apos;s clinical communication systems.
      </p>
    </div>
  );
}

export function RepAgreementSection({
  accepted,
  onAccept,
  onOpenDocument,
}: {
  accepted: boolean;
  onAccept: (v: boolean) => void;
  onOpenDocument: (slug: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Account Agreement
      </h3>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAccept(e.target.checked)}
          className="mt-1"
          required
        />
        <span>
          I have read and agree to the{" "}
          <DocLink slug="terms-of-use" onOpen={onOpenDocument}>
            Terms of Use
          </DocLink>{" "}
          and{" "}
          <DocLink slug="privacy-policy" onOpen={onOpenDocument}>
            Privacy Policy
          </DocLink>
          .
        </span>
      </label>
    </div>
  );
}
