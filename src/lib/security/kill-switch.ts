import { db } from "@/lib/db";
import type { KillSwitchScope } from "@prisma/client";

export async function isKillSwitchActive(
  scope: KillSwitchScope,
  scopeId?: string | null
): Promise<{ blocked: boolean; reason?: string }> {
  const global = await db.securityKillSwitch.findFirst({
    where: { scope: "GLOBAL", active: true },
    orderBy: { createdAt: "desc" },
  });
  if (global) {
    return { blocked: true, reason: global.reason };
  }

  if (!scopeId) return { blocked: false };

  const scoped = await db.securityKillSwitch.findFirst({
    where: { scope, scopeId, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (scoped) {
    return { blocked: true, reason: scoped.reason };
  }

  return { blocked: false };
}

export async function activateKillSwitch(params: {
  scope: KillSwitchScope;
  scopeId?: string | null;
  reason: string;
  activatedById: string;
}) {
  await db.securityKillSwitch.create({
    data: {
      scope: params.scope,
      scopeId: params.scopeId ?? null,
      reason: params.reason,
      activatedById: params.activatedById,
      active: true,
    },
  });

  if (params.scope === "USER" && params.scopeId) {
    await revokeUserSessions(params.scopeId, params.activatedById, params.reason);
  }
  if (params.scope === "ORGANIZATION" && params.scopeId) {
    await db.providerOrganization.update({
      where: { id: params.scopeId },
      data: {
        accessEnabled: false,
        killSwitchAt: new Date(),
        killSwitchReason: params.reason,
      },
    });
  }
  if (params.scope === "COMPANY" && params.scopeId) {
    await db.company.update({
      where: { id: params.scopeId },
      data: {
        accessEnabled: false,
        killSwitchAt: new Date(),
        killSwitchReason: params.reason,
      },
    });
  }
  if (params.scope === "REQUEST" && params.scopeId) {
    await db.serviceRequest.update({
      where: { id: params.scopeId },
      data: {
        accessEnabled: false,
        killSwitchAt: new Date(),
        killSwitchReason: params.reason,
      },
    });
  }
}

export async function deactivateKillSwitch(params: {
  scope: KillSwitchScope;
  scopeId?: string | null;
  deactivatedById: string;
}) {
  await db.securityKillSwitch.updateMany({
    where: {
      scope: params.scope,
      scopeId: params.scopeId ?? null,
      active: true,
    },
    data: {
      active: false,
      deactivatedAt: new Date(),
      deactivatedById: params.deactivatedById,
    },
  });
}

export async function revokeUserSessions(
  userId: string,
  revokedById: string,
  reason?: string
) {
  const user = await db.user.update({
    where: { id: userId },
    data: {
      sessionVersion: { increment: 1 },
      accountState: "REVOKED",
      disabledAt: new Date(),
      disabledById: revokedById,
      disableReason: reason ?? "Session revoked",
      lastSessionRevokedAt: new Date(),
    },
  });

  const { logPermissionChange } = await import("@/lib/security/audit");
  await logPermissionChange({
    targetUserId: userId,
    changedById: revokedById,
    changeType: "SESSION_REVOKED",
    beforeState: { sessionVersion: user.sessionVersion - 1 },
    afterState: { sessionVersion: user.sessionVersion, accountState: "REVOKED" },
    reason,
  });

  return user.sessionVersion;
}

export async function disableUserAccount(
  userId: string,
  disabledById: string,
  reason: string
) {
  await revokeUserSessions(userId, disabledById, reason);
  await db.user.update({
    where: { id: userId },
    data: { accountState: "DISABLED" },
  });
}

export async function checkRequestAccessible(requestId: string): Promise<boolean> {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      accessEnabled: true,
      recordLifecycle: true,
      companyId: true,
      provider: { select: { providerInfo: { select: { organizationId: true } } } },
    },
  });
  if (!request || !request.accessEnabled) return false;
  if (["DESTROYED", "PENDING_DESTRUCTION"].includes(request.recordLifecycle)) {
    return false;
  }

  const companyKill = await isKillSwitchActive("COMPANY", request.companyId);
  if (companyKill.blocked) return false;

  const orgId = request.provider?.providerInfo?.organizationId;
  if (orgId) {
    const org = await db.providerOrganization.findUnique({
      where: { id: orgId },
      select: { accessEnabled: true },
    });
    if (org && !org.accessEnabled) return false;
    const orgKill = await isKillSwitchActive("ORGANIZATION", orgId);
    if (orgKill.blocked) return false;
  }

  const reqKill = await isKillSwitchActive("REQUEST", requestId);
  return !reqKill.blocked;
}
