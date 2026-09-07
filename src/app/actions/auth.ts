"use server";

import { signIn } from "@/lib/auth";
import { canAccessRoute, getDefaultRoute } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import {
  linkSiteToOrganization,
  setProviderSites,
} from "@/lib/healthcare-sites/service";
import { recordAgreementAcceptances } from "@/lib/legal/acceptance";
import {
  PROVIDER_AUTHORIZATION_SLUGS,
  PROVIDER_PRIVACY_SLUGS,
  REP_REQUIRED_SLUGS,
} from "@/lib/legal/documents";
import {
  evaluateVerificationMethod,
  verifyCompanySignup,
  verifyProviderSignup,
} from "@/lib/verification/user-verification";
import {
  acceptInvitation,
  applyInvitationPreconfig,
  validateInvitationToken,
} from "@/lib/invitations/service";
import { signupSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    companyId: formData.get("companyId") || undefined,
    facilityName: formData.get("facilityName") || undefined,
    facilityAddress: formData.get("facilityAddress") || undefined,
    department: formData.get("department") || undefined,
    zipCode: formData.get("zipCode") || undefined,
    facilityContactName: formData.get("facilityContactName") || undefined,
    facilityContactPhone: formData.get("facilityContactPhone") || undefined,
    requesterPhone: formData.get("requesterPhone") || undefined,
    requesterFax: formData.get("requesterFax") || undefined,
    zipCodeStart: formData.get("zipCodeStart") || undefined,
    zipCodeEnd: formData.get("zipCodeEnd") || undefined,
    organizationId: formData.get("organizationId") || undefined,
    requestedOrgName: formData.get("requestedOrgName") || undefined,
    requestOrgAccess: formData.get("requestOrgAccess") === "true" || undefined,
    acceptProviderAuthorization:
      formData.get("acceptProviderAuthorization") === "true" || undefined,
    acceptProviderPrivacy:
      formData.get("acceptProviderPrivacy") === "true" || undefined,
    acceptTermsAndPrivacy:
      formData.get("acceptTermsAndPrivacy") === "true" || undefined,
    siteIds: formData.get("siteIds") || undefined,
    primarySiteId: formData.get("primarySiteId") || undefined,
    inviteToken: formData.get("inviteToken") || undefined,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Validation failed";
    return { error: firstIssue };
  }

  const {
    name,
    email,
    password,
    role,
    companyId,
    facilityName,
    facilityAddress,
    department,
    zipCode,
    facilityContactName,
    facilityContactPhone,
    requesterPhone,
    requesterFax,
    zipCodeStart,
    zipCodeEnd,
    organizationId,
    requestedOrgName,
    requestOrgAccess,
    acceptProviderAuthorization,
    acceptProviderPrivacy,
    acceptTermsAndPrivacy,
    siteIds: siteIdsRaw,
    primarySiteId,
    inviteToken,
  } = parsed.data;

  let siteIds: string[] = [];
  if (typeof siteIdsRaw === "string" && siteIdsRaw.trim()) {
    try {
      const parsedIds = JSON.parse(siteIdsRaw);
      if (Array.isArray(parsedIds)) {
        siteIds = parsedIds.map(String);
      }
    } catch {
      siteIds = siteIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  const normalizedEmail = email.trim().toLowerCase();

  let invitationContext: Awaited<
    ReturnType<typeof validateInvitationToken>
  > | null = null;
  if (inviteToken?.trim()) {
    const validation = await validateInvitationToken(inviteToken.trim());
    if (!validation.valid) {
      return { error: validation.reason };
    }
    if (
      validation.invitation.inviteeEmail &&
      validation.invitation.inviteeEmail !== normalizedEmail
    ) {
      return {
        error: "This invitation was sent to a different email address",
      };
    }
    invitationContext = validation;
  }

  let effectiveRole = role;
  let effectiveOrganizationId = organizationId ?? null;
  let effectiveCompanyId = companyId ?? null;

  if (invitationContext?.valid) {
    const inv = invitationContext.invitation;
    effectiveRole = inv.targetRole as typeof role;
    if (inv.organization?.id) effectiveOrganizationId = inv.organization.id;
    if (inv.company?.id) effectiveCompanyId = inv.company.id;
    if (effectiveRole !== role) {
      return { error: "Account type does not match this invitation" };
    }
  }

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return { error: "An account with this email already exists. Try signing in." };
  }

  if (effectiveCompanyId) {
    const company = await db.company.findFirst({
      where: { id: effectiveCompanyId, active: true },
    });
    if (!company) {
      return { error: "Selected device company not found" };
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let linkedOrganizationId = effectiveOrganizationId;
  if (role === "PROVIDER" && requestOrgAccess && requestedOrgName?.trim()) {
    const orgName = requestedOrgName.trim();
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const org = await db.providerOrganization.create({
      data: {
        name: orgName,
        slug: `${slug}-${Date.now().toString(36)}`,
        status: "PENDING",
        complianceMode: "STANDARD",
      },
    });
    linkedOrganizationId = org.id;

    await db.organizationAccessRequest.create({
      data: {
        organizationId: org.id,
        requestedOrgName: orgName,
        email: normalizedEmail,
        name: name.trim(),
        facilityName: facilityName?.trim(),
        department: department?.trim(),
        zipCode: zipCode?.trim().slice(0, 5),
        status: "PENDING",
      },
    });
  }

  if (role === "PROVIDER" && linkedOrganizationId) {
    const org = await db.providerOrganization.findUnique({
      where: { id: linkedOrganizationId },
    });
    if (org) {
      const preview = evaluateVerificationMethod(
        {
          id: org.id,
          userVerificationMethod: org.userVerificationMethod,
          approvedEmailDomains: org.approvedEmailDomains,
          ssoEnabled: org.ssoEnabled,
          scimEnabled: org.scimEnabled,
          status: org.status,
          accessEnabled: org.accessEnabled,
        },
        normalizedEmail,
        { hasInvitation: Boolean(invitationContext?.valid) }
      );
      if (preview.decision === "REJECTED") {
        return { error: preview.reason };
      }
      if (
        preview.decision === "REQUIRES_INVITATION" &&
        !invitationContext?.valid
      ) {
        return { error: preview.reason };
      }
    }
  }

  if (["REP", "COMPANY_ADMIN"].includes(role) && effectiveCompanyId) {
    const company = await db.company.findUnique({
      where: { id: effectiveCompanyId },
    });
    if (company) {
      const preview = evaluateVerificationMethod(
        {
          id: company.id,
          userVerificationMethod: company.userVerificationMethod,
          approvedEmailDomains: company.approvedEmailDomains,
          ssoEnabled: company.ssoEnabled,
          scimEnabled: company.scimEnabled,
          accessEnabled: company.accessEnabled,
        },
        normalizedEmail,
        { hasInvitation: Boolean(invitationContext?.valid) }
      );
      if (preview.decision === "REJECTED") {
        return { error: preview.reason };
      }
      if (
        preview.decision === "REQUIRES_INVITATION" &&
        !invitationContext?.valid
      ) {
        return { error: preview.reason };
      }
    }
  }

  let organizationName: string | null = null;
  if (linkedOrganizationId) {
    const org = await db.providerOrganization.findUnique({
      where: { id: linkedOrganizationId },
      select: { name: true },
    });
    organizationName = org?.name ?? requestedOrgName?.trim() ?? null;
  }

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      companyId: effectiveCompanyId ?? null,
      ...(role === "COMPANY_ADMIN" && {
        zipCodeStart: zipCodeStart?.trim().slice(0, 5) ?? null,
        zipCodeEnd: zipCodeEnd?.trim().slice(0, 5) ?? null,
      }),
      ...(role === "PROVIDER" && {
        phone: requesterPhone?.trim() || null,
        providerInfo: {
          create: {
            organizationId: linkedOrganizationId,
            accountStatus: "LIMITED",
            onboardingComplete: false,
            onboardingStep: linkedOrganizationId ? 2 : 1,
            facilityName: facilityName?.trim() || null,
            facilityAddress: facilityAddress?.trim() || null,
            facilityContactName: facilityContactName?.trim() || null,
            facilityContactPhone: facilityContactPhone?.trim() || null,
            department: department?.trim() || null,
            zipCode: zipCode?.trim().slice(0, 5) ?? null,
            requesterPhone: requesterPhone?.trim() || null,
            requesterFax: requesterFax?.trim() || null,
            workEmail: normalizedEmail,
          },
        },
      }),
      ...(role === "REP" && {
        repProfile: {
          create: {
            status: "OFF_DUTY",
            credentialStatus: "PENDING",
            products: [],
            companies: effectiveCompanyId
              ? [
                  (
                    await db.company.findUnique({
                      where: { id: effectiveCompanyId },
                      select: { name: true },
                    })
                  )?.name ?? "",
                ].filter(Boolean)
              : [],
          },
        },
      }),
    },
  });

  const legalName = name.trim();
  if (role === "PROVIDER" && acceptProviderAuthorization && acceptProviderPrivacy) {
    await recordAgreementAcceptances(
      [...PROVIDER_AUTHORIZATION_SLUGS, ...PROVIDER_PRIVACY_SLUGS],
      {
        userId: user.id,
        legalName,
        role,
        organizationId: linkedOrganizationId,
        organizationName,
        facilityName: facilityName?.trim() ?? null,
        signatureText: `${legalName} — provider signup acceptance`,
      }
    );
  } else if (
    ["REP", "COMPANY_ADMIN"].includes(role) &&
    acceptTermsAndPrivacy
  ) {
    await recordAgreementAcceptances([...REP_REQUIRED_SLUGS], {
      userId: user.id,
      legalName,
      role,
      signatureText: `${legalName} — account signup acceptance`,
    });
  }

  if (role === "PROVIDER" && linkedOrganizationId) {
    await verifyProviderSignup({
      userId: user.id,
      email: normalizedEmail,
      legalName,
      organizationId: linkedOrganizationId,
      jobTitle: department?.trim() ?? null,
      facilityId: null,
      invitationToken: inviteToken?.trim() ?? null,
    });

    await db.organizationAccessRequest.updateMany({
      where: {
        email: normalizedEmail,
        organizationId: linkedOrganizationId,
        status: "PENDING",
      },
      data: { userId: user.id },
    });
  }

  if (role === "PROVIDER" && siteIds.length > 0) {
    await setProviderSites(user.id, siteIds, {
      organizationId: linkedOrganizationId,
      primarySiteId: primarySiteId ?? siteIds[0],
      department: department?.trim() ?? null,
    });
    if (linkedOrganizationId) {
      for (const siteId of siteIds) {
        await linkSiteToOrganization(
          linkedOrganizationId,
          siteId,
          siteId === (primarySiteId ?? siteIds[0])
        );
      }
    }
  }

  if (["REP", "COMPANY_ADMIN"].includes(role) && effectiveCompanyId) {
    await verifyCompanySignup({
      userId: user.id,
      email: normalizedEmail,
      legalName,
      companyId: effectiveCompanyId,
      invitationToken: inviteToken?.trim() ?? null,
    });
  }

  if (inviteToken?.trim()) {
    try {
      const accepted = await acceptInvitation({
        token: inviteToken.trim(),
        acceptedByUserId: user.id,
        acceptedEmail: normalizedEmail,
      });
      await applyInvitationPreconfig(user.id, accepted);
    } catch {
      // Verification may have already accepted the invitation.
      const pending = await db.platformInvitation.findFirst({
        where: { token: inviteToken.trim(), status: "PENDING" },
      });
      if (pending) {
        await applyInvitationPreconfig(user.id, pending);
      }
    }
  } else if (invitationContext?.valid) {
    const pending = await db.platformInvitation.findUnique({
      where: { id: invitationContext.invitation.id },
    });
    if (pending) await applyInvitationPreconfig(user.id, pending);
  }

  try {
    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirectTo: role === "PROVIDER" ? "/provider/onboarding" : getDefaultRoute(role),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return {
        error:
          "Account created, but automatic sign-in failed. Please sign in with your email and password.",
      };
    }
    throw error;
  }
}

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : getDefaultRoute(user.role);

  const redirectTo = canAccessRoute(user.role, safeCallback)
    ? safeCallback
    : getDefaultRoute(user.role);

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }

  return null;
}
