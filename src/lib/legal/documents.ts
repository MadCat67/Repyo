import type { Role } from "@prisma/client";

export const LEGAL_DOCUMENT_VERSION = "1.0.0";

export type LegalDocDefinition = {
  slug: string;
  title: string;
  version: string;
  roleScopes: Role[];
  summary: string;
  content: string;
};

export const PROVIDER_REQUIRED_SLUGS = [
  "provider-user-agreement",
  "phi-security-requirements",
  "privacy-policy",
  "terms-of-use",
] as const;

export const REP_REQUIRED_SLUGS = ["terms-of-use", "privacy-policy"] as const;

export const COMPANY_ADMIN_REQUIRED_SLUGS = ["terms-of-use", "privacy-policy"] as const;

export function requiredSlugsForRole(role: Role): readonly string[] {
  if (role === "PROVIDER") return PROVIDER_REQUIRED_SLUGS;
  if (role === "REP") return REP_REQUIRED_SLUGS;
  if (role === "COMPANY_ADMIN") return COMPANY_ADMIN_REQUIRED_SLUGS;
  return [];
}

/** Checkbox 1 → these documents */
export const PROVIDER_AUTHORIZATION_SLUGS = [
  "provider-user-agreement",
  "phi-security-requirements",
] as const;

/** Checkbox 2 → these documents */
export const PROVIDER_PRIVACY_SLUGS = ["privacy-policy", "terms-of-use"] as const;

export const LEGAL_DOCUMENTS: LegalDocDefinition[] = [
  {
    slug: "provider-user-agreement",
    title: "RepYo Healthcare Provider User Agreement",
    version: LEGAL_DOCUMENT_VERSION,
    roleScopes: ["PROVIDER"],
    summary:
      "Individual clickwrap agreement for authorized healthcare workers using RepYo on behalf of a covered entity.",
    content: `# RepYo Healthcare Provider User Agreement

**Version ${LEGAL_DOCUMENT_VERSION} · GoRepYo LLC**

## 1. Parties and purpose

This Healthcare Provider User Agreement ("Agreement") is between you, an individual authorized healthcare worker, and GoRepYo LLC ("RepYo," "we," "us"). RepYo provides a representative-support request and scheduling platform. RepYo is **not** an emergency service, electronic health record, or substitute for your organization's clinical communication systems.

## 2. Your authorization

You represent and warrant that:

- You are employed by or otherwise authorized by the healthcare organization identified in your account to use RepYo for legitimate professional purposes.
- You will use RepYo only within the scope of your professional duties and organizational policies.
- You will not share your credentials or allow unauthorized persons to access RepYo using your account.

## 3. Protected health information (PHI)

When your organization has executed a Business Associate Agreement (BAA) with GoRepYo LLC and has been PHI-enabled in RepYo:

- You may enter, access, and transmit PHI only as authorized by your organization and as reasonably necessary to request representative support.
- You are responsible for entering accurate information and verifying patient identity before submission.
- You must not enter PHI when your organization is in Standard (non-PHI) mode.

When your organization is **not** PHI-enabled, you must **not** submit patient-identifiable information.

## 4. Minimum necessary and professional responsibility

You agree to limit PHI to the minimum reasonably necessary for the rep request. You remain responsible for compliance with your organization's policies, applicable law, and professional standards.

## 5. Security obligations

You agree to:

- Maintain the confidentiality of your login credentials
- Use strong passwords and comply with MFA when enabled
- Report suspected unauthorized access or security incidents promptly to your organization and RepYo
- Not attempt to circumvent RepYo's access controls or audit systems

## 6. Electronic records and signatures

Your electronic acceptance of this Agreement constitutes your legal signature. RepYo maintains audit records of acceptance including your identity, organization, document version, and timestamp.

## 7. Termination

Your access may be suspended or terminated by your organization, RepYo, or upon violation of this Agreement. Provisions regarding audit, confidentiality, and permitted use of information survive termination.

## 8. Disclaimer

REPYO IS PROVIDED "AS IS." TO THE MAXIMUM EXTENT PERMITTED BY LAW, REPYO DISCLAIMS WARRANTIES AND LIMITS LIABILITY AS SET FORTH IN THE TERMS OF USE.

## 9. Contact

Questions regarding this Agreement: legal@gorepyo.com
`,
  },
  {
    slug: "phi-security-requirements",
    title: "PHI, Privacy & Security Requirements",
    version: LEGAL_DOCUMENT_VERSION,
    roleScopes: ["PROVIDER"],
    summary:
      "Security and privacy requirements for healthcare providers accessing PHI through RepYo.",
    content: `# PHI, Privacy & Security Requirements

**Version ${LEGAL_DOCUMENT_VERSION} · GoRepYo LLC**

## Scope

These requirements apply when you access or submit protected health information (PHI) through RepYo on behalf of a PHI-enabled healthcare organization.

## Access controls

- PHI is visible only to authorized users after appropriate request workflow states.
- Patient identifiers are not displayed in notifications, alerts, or lock screens.
- Access is logged for audit purposes (who, when, organization context).

## Permitted use

You may use PHI in RepYo only to:

- Request medical device representative support
- Coordinate scheduling and case support with manufacturer representatives
- Complete CRM device lookups when enabled by your organization

## Prohibited conduct

You must not:

- Access PHI for unrelated purposes
- Export or screenshot PHI except as permitted by organizational policy
- Include PHI in free-text fields when not required
- Share request details with unauthorized parties

## Incident reporting

Report suspected breaches, misrouted requests, or unauthorized access immediately to your organization's privacy officer and to RepYo at security@gorepyo.com.

## Organizational agreements

Enterprise HIPAA obligations (including BAA execution) are between your healthcare organization and GoRepYo LLC. This document describes your individual responsibilities as an authorized user.
`,
  },
  {
    slug: "privacy-policy",
    title: "RepYo Privacy Policy",
    version: LEGAL_DOCUMENT_VERSION,
    roleScopes: ["PROVIDER", "REP", "COMPANY_ADMIN"],
    summary: "How RepYo collects, uses, and protects personal information.",
    content: `# RepYo Privacy Policy

**Version ${LEGAL_DOCUMENT_VERSION} · GoRepYo LLC**

## Information we collect

- **Account information:** name, email, phone, role, organization affiliation
- **Professional information:** facility, department, territory (as applicable)
- **Usage and audit data:** login events, agreement acceptances, access logs (without unnecessary duplication of PHI in logs)
- **PHI:** only when submitted by authorized users of PHI-enabled organizations, encrypted at rest

## How we use information

- Provide request routing, scheduling, and representative coordination
- Send service notifications (without patient identifiers in alert content)
- Maintain security, audit trails, and legal compliance records
- Improve platform reliability and support

## Electronic communications

By creating an account, you consent to receive electronic service communications including security notices, scheduling updates, and request notifications via email and in-app alerts.

## Sharing

We do not sell personal information. We share data with:

- Your healthcare organization (for provider users)
- Device manufacturer teams you request support from
- Service providers under contract (hosting, email) subject to appropriate safeguards
- As required by law

## Retention

We retain account and audit records according to organizational agreements and legal requirements. PHI retention follows BAA terms and secure destruction procedures.

## Your rights

Contact privacy@gorepyo.com for access, correction, or deletion requests subject to legal and contractual obligations.

## Contact

GoRepYo LLC · privacy@gorepyo.com
`,
  },
  {
    slug: "terms-of-use",
    title: "RepYo Terms of Use",
    version: LEGAL_DOCUMENT_VERSION,
    roleScopes: ["PROVIDER", "REP", "COMPANY_ADMIN"],
    summary: "Platform terms governing use of GoRepYo services.",
    content: `# RepYo Terms of Use

**Version ${LEGAL_DOCUMENT_VERSION} · GoRepYo LLC**

## 1. Service description

GoRepYo connects healthcare providers with medical device representatives for support requests and scheduling. RepYo is not for medical emergencies. Call 911 or use your organization's emergency protocols for urgent clinical situations.

## 2. Acceptable use

You agree to use RepYo lawfully and professionally. You may not misuse the platform, attempt unauthorized access, or interfere with other users.

## 3. Accounts

You are responsible for account security. RepYo may suspend accounts for security incidents, policy violations, or at organization request.

## 4. Intellectual property

RepYo and its content are owned by GoRepYo LLC. You receive a limited license to use the platform for its intended purpose.

## 5. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, REPYO'S LIABILITY IS LIMITED. REPYO IS NOT LIABLE FOR CLINICAL DECISIONS, DEVICE OUTCOMES, OR EMERGENCY SITUATIONS.

## 6. Changes

We may update these Terms. Material changes will require renewed acceptance where legally required.

## 7. Governing law

These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-law principles.

## Contact

legal@gorepyo.com
`,
  },
];
