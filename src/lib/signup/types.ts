import type { Role } from "@prisma/client";

export type SignupPayload = {
  name: string;
  role: Role;
  companyId?: string | null;
  organizationId?: string | null;
  linkedOrganizationId?: string | null;
  facilityName?: string | null;
  facilityAddress?: string | null;
  department?: string | null;
  zipCode?: string | null;
  facilityContactName?: string | null;
  facilityContactPhone?: string | null;
  requesterPhone?: string | null;
  requesterFax?: string | null;
  zipCodeStart?: string | null;
  zipCodeEnd?: string | null;
  acceptProviderAuthorization?: boolean;
  acceptProviderPrivacy?: boolean;
  acceptTermsAndPrivacy?: boolean;
  siteIds?: string[];
  primarySiteId?: string | null;
  inviteToken?: string | null;
  requireManualApproval?: boolean;
  grantOrgAdministrator?: boolean;
};
