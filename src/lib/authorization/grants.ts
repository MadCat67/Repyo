import { db } from "@/lib/db";
import type { AuthorizationSource, Prisma } from "@prisma/client";
import { logPermissionChange } from "@/lib/security/audit";
import { ADMIN_PERMISSIONS } from "@/lib/security/authorization";

export async function recordAuthorizationGrant(params: {
  userId: string;
  grantedById?: string | null;
  organizationId?: string | null;
  companyId?: string | null;
  facilityId?: string | null;
  grantType: string;
  permissions?: string[];
  source: AuthorizationSource;
  ownerLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return db.authorizationGrant.create({
    data: {
      userId: params.userId,
      grantedById: params.grantedById ?? null,
      organizationId: params.organizationId ?? null,
      companyId: params.companyId ?? null,
      facilityId: params.facilityId ?? null,
      grantType: params.grantType,
      permissions: params.permissions ?? [],
      source: params.source,
      ownerLabel: params.ownerLabel ?? null,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function grantOrgAdministrator(params: {
  targetUserId: string;
  grantedById: string;
  organizationId: string;
  facilityId?: string | null;
  reason?: string;
  source?: AuthorizationSource;
}) {
  const profile = await db.providerProfile.findUnique({
    where: { userId: params.targetUserId },
  });
  if (!profile || profile.organizationId !== params.organizationId) {
    throw new Error("User is not a member of this organization");
  }

  const before = {
    isOrgAdministrator: profile.isOrgAdministrator,
    orgAdminGrantedById: profile.orgAdminGrantedById,
    orgAdminGrantedAt: profile.orgAdminGrantedAt,
  };

  const now = new Date();
  const source = params.source ?? "ADMIN_GRANT";

  await db.providerProfile.update({
    where: { userId: params.targetUserId },
    data: {
      isOrgAdministrator: true,
      orgAdminGrantedById: params.grantedById,
      orgAdminGrantedAt: now,
    },
  });

  await recordAuthorizationGrant({
    userId: params.targetUserId,
    grantedById: params.grantedById,
    organizationId: params.organizationId,
    facilityId: params.facilityId ?? profile.facilityId,
    grantType: "ORG_ADMINISTRATOR",
    permissions: ["MANAGE_ORG_USERS", "MANAGE_ORG_SETTINGS", "APPROVE_USERS"],
    source,
    ownerLabel: `Granted by user ${params.grantedById}`,
    metadata: { reason: params.reason },
  });

  await logPermissionChange({
    targetUserId: params.targetUserId,
    changedById: params.grantedById,
    changeType: "ORG_ADMIN_GRANTED",
    beforeState: before,
    afterState: {
      isOrgAdministrator: true,
      orgAdminGrantedById: params.grantedById,
      orgAdminGrantedAt: now.toISOString(),
      organizationId: params.organizationId,
      source,
    },
    reason: params.reason ?? "Organization administrator privileges granted",
  });
}

export async function revokeOrgAdministrator(params: {
  targetUserId: string;
  revokedById: string;
  organizationId: string;
  reason?: string;
}) {
  const profile = await db.providerProfile.findUnique({
    where: { userId: params.targetUserId },
  });
  if (!profile || profile.organizationId !== params.organizationId) {
    throw new Error("User is not a member of this organization");
  }

  const before = {
    isOrgAdministrator: profile.isOrgAdministrator,
    orgAdminGrantedById: profile.orgAdminGrantedById,
    orgAdminGrantedAt: profile.orgAdminGrantedAt,
  };

  await db.providerProfile.update({
    where: { userId: params.targetUserId },
    data: {
      isOrgAdministrator: false,
      orgAdminGrantedById: null,
      orgAdminGrantedAt: null,
    },
  });

  await db.authorizationGrant.updateMany({
    where: {
      userId: params.targetUserId,
      organizationId: params.organizationId,
      grantType: "ORG_ADMINISTRATOR",
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedById: params.revokedById,
    },
  });

  await logPermissionChange({
    targetUserId: params.targetUserId,
    changedById: params.revokedById,
    changeType: "ORG_ADMIN_REVOKED",
    beforeState: before,
    afterState: {
      isOrgAdministrator: false,
      organizationId: params.organizationId,
    },
    reason: params.reason ?? "Organization administrator privileges revoked",
  });
}

export async function grantCompanyAdminPermissions(params: {
  targetUserId: string;
  grantedById: string;
  companyId: string;
  permissions: string[];
  reason?: string;
  source?: AuthorizationSource;
}) {
  const user = await db.user.findUnique({ where: { id: params.targetUserId } });
  if (!user || user.companyId !== params.companyId) {
    throw new Error("User is not a member of this company");
  }

  const validPermissions = new Set(Object.values(ADMIN_PERMISSIONS));
  const permissions = params.permissions.filter((p) => validPermissions.has(p as typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS]));
  if (permissions.length === 0) {
    throw new Error("No valid permissions specified");
  }

  const before = { adminPermissions: user.adminPermissions };
  const merged = Array.from(new Set([...user.adminPermissions, ...permissions]));

  await db.user.update({
    where: { id: params.targetUserId },
    data: { adminPermissions: merged },
  });

  await recordAuthorizationGrant({
    userId: params.targetUserId,
    grantedById: params.grantedById,
    companyId: params.companyId,
    grantType: "COMPANY_ADMIN_PERMISSION",
    permissions,
    source: params.source ?? "ADMIN_GRANT",
    ownerLabel: `Granted by user ${params.grantedById}`,
    metadata: { reason: params.reason },
  });

  await logPermissionChange({
    targetUserId: params.targetUserId,
    changedById: params.grantedById,
    changeType: "ADMIN_PERMISSIONS_CHANGED",
    beforeState: before,
    afterState: { adminPermissions: merged, companyId: params.companyId },
    reason: params.reason ?? "Company administrator permissions granted",
  });
}

export async function isOrgAdministrator(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const profile = await db.providerProfile.findUnique({
    where: { userId },
    select: { isOrgAdministrator: true, organizationId: true },
  });
  return (
    profile?.organizationId === organizationId &&
    profile.isOrgAdministrator === true
  );
}
