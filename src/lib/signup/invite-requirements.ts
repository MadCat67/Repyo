import { db } from "@/lib/db";
import { emailMatchesApprovedDomain } from "@/lib/verification/email-domain";
import type { UserVerificationMethod } from "@prisma/client";

const MANUAL_METHODS: UserVerificationMethod[] = [
  "MANUAL_ADMIN_APPROVAL",
  "EMAIL_DOMAIN_PLUS_ADMIN_APPROVAL",
];

export type InviteSignupRequirements = {
  domainAllowed: boolean;
  domainReason: string | null;
  requireManualApproval: boolean;
  approver: "company_admin" | "org_admin" | "super_admin";
};

export async function resolveInviteSignupRequirements(params: {
  email: string;
  companyId?: string | null;
  organizationId?: string | null;
  invitationId?: string | null;
}): Promise<InviteSignupRequirements> {
  const email = params.email.trim().toLowerCase();
  let requireManualApproval = false;
  let approver: InviteSignupRequirements["approver"] = "super_admin";

  if (params.companyId) {
    approver = "company_admin";
    const company = await db.company.findUnique({
      where: { id: params.companyId },
      select: {
        userVerificationMethod: true,
        approvedEmailDomains: true,
      },
    });

    if (company) {
      if (MANUAL_METHODS.includes(company.userVerificationMethod)) {
        requireManualApproval = true;
      }
      if (company.approvedEmailDomains.length > 0) {
        const domainAllowed = emailMatchesApprovedDomain(
          email,
          company.approvedEmailDomains
        );
        if (!domainAllowed) {
          return {
            domainAllowed: false,
            domainReason:
              "Your email domain is not approved for this company. Use your work email or contact your administrator.",
            requireManualApproval,
            approver,
          };
        }
      }
    }
  }

  if (params.organizationId) {
    approver = "org_admin";
    const org = await db.providerOrganization.findUnique({
      where: { id: params.organizationId },
      select: {
        userVerificationMethod: true,
        approvedEmailDomains: true,
      },
    });

    if (org) {
      if (MANUAL_METHODS.includes(org.userVerificationMethod)) {
        requireManualApproval = true;
      }
      if (org.approvedEmailDomains.length > 0) {
        const domainAllowed = emailMatchesApprovedDomain(
          email,
          org.approvedEmailDomains
        );
        if (!domainAllowed) {
          return {
            domainAllowed: false,
            domainReason:
              "Your email domain is not approved for this organization. Use your hospital work email or contact your administrator.",
            requireManualApproval,
            approver: "super_admin",
          };
        }
      }
    }
  }

  if (params.invitationId) {
    const invitation = await db.platformInvitation.findUnique({
      where: { id: params.invitationId },
      select: { teamId: true, organizationId: true, companyId: true },
    });

    if (invitation?.teamId) {
      const team = await db.companyTeam.findUnique({
        where: { id: invitation.teamId },
        select: { requireManualVerification: true },
      });
      if (team?.requireManualVerification) {
        requireManualApproval = true;
      }
    }
  }

  return {
    domainAllowed: true,
    domainReason: null,
    requireManualApproval,
    approver: params.organizationId ? "super_admin" : approver,
  };
}
