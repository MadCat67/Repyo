import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activateKillSwitch,
  deactivateKillSwitch,
  disableUserAccount,
  revokeUserSessions,
} from "@/lib/security/kill-switch";
import { hasSecurityPermission, SECURITY_PERMISSIONS } from "@/lib/security/authorization";
import { toSessionUser } from "@/lib/security/sanitize-request";
import type { KillSwitchScope } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = toSessionUser({
    id: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    adminPermissions: session.user.adminPermissions,
  });

  if (
    session.user.role !== "SUPER_ADMIN" &&
    !hasSecurityPermission(actor, SECURITY_PERMISSIONS.VIEW_AUDIT_LOGS)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  const [killSwitches, phiLogs, routingEvents, permissionChanges] =
    await Promise.all([
      db.securityKillSwitch.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { activatedBy: { select: { name: true, email: true } } },
      }),
      db.phiAccessLog.findMany({
        where: requestId ? { requestId } : undefined,
        orderBy: { createdAt: "desc" },
        take: requestId ? 100 : 50,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      requestId
        ? db.requestRoutingEvent.findMany({
            where: { requestId },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      db.permissionChangeLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          targetUser: { select: { name: true, email: true } },
          changedBy: { select: { name: true, email: true } },
        },
      }),
    ]);

  return NextResponse.json({
    killSwitches,
    phiAccessLogs: phiLogs,
    routingEvents,
    permissionChanges,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = toSessionUser({
    id: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    adminPermissions: session.user.adminPermissions,
  });

  if (
    session.user.role !== "SUPER_ADMIN" &&
    !hasSecurityPermission(actor, SECURITY_PERMISSIONS.SECURITY_KILL_SWITCH)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "kill_switch") {
    const scope = body.scope as KillSwitchScope;
    if (!scope || !body.reason?.trim()) {
      return NextResponse.json({ error: "scope and reason required" }, { status: 400 });
    }
    await activateKillSwitch({
      scope,
      scopeId: body.scopeId ?? null,
      reason: body.reason.trim(),
      activatedById: session.user.id,
    });
    return NextResponse.json({ activated: true });
  }

  if (action === "deactivate_kill_switch") {
    await deactivateKillSwitch({
      scope: body.scope as KillSwitchScope,
      scopeId: body.scopeId ?? null,
      deactivatedById: session.user.id,
    });
    return NextResponse.json({ deactivated: true });
  }

  if (action === "revoke_sessions") {
    if (
      session.user.role !== "SUPER_ADMIN" &&
      !hasSecurityPermission(actor, SECURITY_PERMISSIONS.REVOKE_SESSIONS)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!body.userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    await revokeUserSessions(body.userId, session.user.id, body.reason);
    return NextResponse.json({ revoked: true });
  }

  if (action === "disable_user") {
    if (!body.userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    await disableUserAccount(
      body.userId,
      session.user.id,
      body.reason ?? "Account disabled by security administrator"
    );
    return NextResponse.json({ disabled: true });
  }

  if (action === "archive_request") {
    if (!body.requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }
    await db.serviceRequest.update({
      where: { id: body.requestId },
      data: { recordLifecycle: "ARCHIVED" },
    });
    return NextResponse.json({ archived: true });
  }

  if (action === "legal_hold") {
    if (!body.requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }
    await db.serviceRequest.update({
      where: { id: body.requestId },
      data: { recordLifecycle: "LEGAL_HOLD" },
    });
    return NextResponse.json({ legalHold: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
