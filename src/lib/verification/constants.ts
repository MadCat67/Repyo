import type { UserVerificationMethod } from "@prisma/client";

export const VERIFICATION_METHOD_LABELS: Record<UserVerificationMethod, string> = {
  MANUAL_ADMIN_APPROVAL: "Manual Admin Approval",
  APPROVED_EMAIL_DOMAIN: "Approved Email Domain",
  EMAIL_DOMAIN_PLUS_ADMIN_APPROVAL: "Email Domain + Admin Approval",
  INVITATION_ONLY: "Invitation Only",
  PREAPPROVED_ROSTER: "Preapproved Roster",
  SSO: "SSO",
  SCIM: "SCIM",
  API_DIRECTORY_VERIFICATION: "API / Directory Verification",
};

export const VERIFICATION_METHODS: UserVerificationMethod[] = [
  "MANUAL_ADMIN_APPROVAL",
  "APPROVED_EMAIL_DOMAIN",
  "EMAIL_DOMAIN_PLUS_ADMIN_APPROVAL",
  "INVITATION_ONLY",
  "PREAPPROVED_ROSTER",
  "SSO",
  "SCIM",
  "API_DIRECTORY_VERIFICATION",
];

export const GRANT_TYPES = {
  ORG_ACCOUNT_ACCESS: "ORG_ACCOUNT_ACCESS",
  ORG_ADMINISTRATOR: "ORG_ADMINISTRATOR",
  COMPANY_ACCOUNT_ACCESS: "COMPANY_ACCOUNT_ACCESS",
  COMPANY_ADMIN_PERMISSION: "COMPANY_ADMIN_PERMISSION",
} as const;

/** High-risk actions that should eventually require step-up MFA. */
export const HIGH_RISK_ACTIONS = [
  "GRANT_ORG_ADMIN",
  "GRANT_COMPANY_ADMIN_PERMISSION",
  "BULK_EXPORT",
  "CHANGE_PHI_PERMISSIONS",
  "CHANGE_ORG_SECURITY_SETTINGS",
] as const;
