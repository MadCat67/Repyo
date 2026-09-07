import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/teams/authorization";
import { updateTeamDefaultPolicy } from "@/lib/teams/calendar-visibility";
import { logPermissionChange } from "@/lib/security/audit";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await context.params;
  if (!(await canManageTeam(session.user, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const team = await db.companyTeam.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.managerUserId) data.managerUserId = body.managerUserId;

  if (Object.keys(data).length > 0) {
    await db.companyTeam.update({ where: { id: teamId }, data });
  }

  if (body.defaultCalendarVisibility) {
    const visibility =
      body.defaultCalendarVisibility === "HIDDEN_FROM_TEAM_PEERS"
        ? "HIDDEN_FROM_TEAM_PEERS"
        : "SHARED_WITH_TEAM";
    await updateTeamDefaultPolicy(
      teamId,
      visibility,
      session.user.id,
      team.managerUserId,
      body.reason
    );
  }

  const updated = await db.companyTeam.findUnique({
    where: { id: teamId },
    include: {
      manager: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await context.params;
  if (!(await canManageTeam(session.user, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.companyTeam.delete({ where: { id: teamId } });

  await logPermissionChange({
    targetUserId: session.user.id,
    changedById: session.user.id,
    changeType: "TEAM_MEMBERSHIP_CHANGED",
    beforeState: { teamId, permissionLayer: "team_management" },
    afterState: { teamId: null },
    reason: "Team deleted",
  });

  return NextResponse.json({ ok: true });
}
