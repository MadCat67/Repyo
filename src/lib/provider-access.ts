import { db } from "./db";
import type {
  ProviderAccountStatus,
  ProviderOrgComplianceMode,
  ProviderOrgStatus,
} from "@prisma/client";

export interface ProviderAccessContext {
  accountStatus: ProviderAccountStatus;
  onboardingComplete: boolean;
  organizationId: string | null;
  organizationName: string | null;
  orgStatus: ProviderOrgStatus | null;
  complianceMode: ProviderOrgComplianceMode | null;
  phiEnabled: boolean;
  canSubmitPhi: boolean;
  canSubmitRequests: boolean;
  isLimitedMode: boolean;
  message: string | null;
}

export async function getProviderAccess(
  userId: string
): Promise<ProviderAccessContext | null> {
  const profile = await db.providerProfile.findUnique({
    where: { userId },
    include: {
      organization: true,
    },
  });

  if (!profile) return null;

  const org = profile.organization;
  const phiEnabled =
    org?.complianceMode === "PHI_ENABLED" &&
    org?.status === "ACTIVATED" &&
    Boolean(org?.phiEnabledAt);

  const canSubmitRequests =
    profile.onboardingComplete &&
    profile.accountStatus === "ACTIVE";

  const canSubmitLimitedRequests =
    profile.onboardingComplete &&
    ["ACTIVE", "LIMITED"].includes(profile.accountStatus);

  const canSubmitPhi =
    phiEnabled &&
    profile.accountStatus === "ACTIVE" &&
    profile.termsAcceptedAt != null &&
    profile.userAgreementAt != null;

  const isLimitedMode = !canSubmitPhi;

  let message: string | null = null;
  if (profile.accountStatus === "PENDING_APPROVAL") {
    message =
      "Your account is pending approval by your organization administrator. You can explore RepYo, but full access will be enabled after verification.";
  } else if (!profile.onboardingComplete) {
    message = "Complete onboarding to start using GoRepYo.";
  } else if (!org) {
    message =
      "Your organization is not yet activated for GoRepYo. You can explore the platform, but patient information cannot be submitted until your organization completes verification and required agreements.";
  } else if (org.status !== "ACTIVATED") {
    message = `Your organization (${org.name}) is not yet activated for GoRepYo. You may create your profile and submit non-PHI rep requests. We'll notify you when PHI features are enabled.`;
  } else if (!phiEnabled) {
    message =
      "Your organization is verified but PHI features are not yet enabled. Submit rep requests without patient-identifiable information.";
  }

  return {
    accountStatus: profile.accountStatus,
    onboardingComplete: profile.onboardingComplete,
    organizationId: org?.id ?? null,
    organizationName: org?.name ?? null,
    orgStatus: org?.status ?? null,
    complianceMode: org?.complianceMode ?? null,
    phiEnabled,
    canSubmitPhi,
    canSubmitRequests: canSubmitLimitedRequests,
    isLimitedMode,
    message,
  };
}
