import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { validateInvitationToken } from "@/lib/invitations/service";
import { ROLE_LABELS } from "@/lib/auth-utils";
import type { Role } from "@prisma/client";

type PageProps = { params: Promise<{ token: string }> };

export default async function InviteLandingPage({ params }: PageProps) {
  const { token } = await params;
  const result = await validateInvitationToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <BrandMark size="lg" />
        </div>

        {!result.valid ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Invitation unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">{result.reason}</p>
            <Link href="/login" className="mt-6 block">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">You&apos;re invited to RepYo</h1>
            <p className="mt-2 text-sm text-slate-600">
              {result.invitation.invitedByName} invited you to join as a{" "}
              {ROLE_LABELS[result.invitation.targetRole as Role]}.
            </p>

            <dl className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
              {result.invitation.organization && (
                <div>
                  <dt className="text-slate-500">Organization</dt>
                  <dd className="font-medium">{result.invitation.organization.name}</dd>
                </div>
              )}
              {result.invitation.company && (
                <div>
                  <dt className="text-slate-500">Company</dt>
                  <dd className="font-medium">{result.invitation.company.name}</dd>
                </div>
              )}
              {result.invitation.team && (
                <div>
                  <dt className="text-slate-500">Team</dt>
                  <dd className="font-medium">{result.invitation.team.name}</dd>
                </div>
              )}
              {result.invitation.healthcareSite && (
                <div>
                  <dt className="text-slate-500">Facility</dt>
                  <dd className="font-medium">{result.invitation.healthcareSite.name}</dd>
                </div>
              )}
              {result.invitation.inviteeEmail && (
                <div>
                  <dt className="text-slate-500">Invited email</dt>
                  <dd className="font-medium">{result.invitation.inviteeEmail}</dd>
                </div>
              )}
            </dl>

            <p className="mt-4 text-xs text-slate-500">
              Accepting this invitation does not grant access to patient information.
              Your organization&apos;s verification policy still applies after signup.
            </p>

            <Link
              href={`/signup?invite=${encodeURIComponent(token)}`}
              className="mt-6 block"
            >
              <Button className="w-full">Create your account</Button>
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">
              Expires {new Date(result.invitation.expiresAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
