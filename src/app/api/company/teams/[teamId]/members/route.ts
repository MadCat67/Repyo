import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/teams/authorization";
import { logPermissionChange } from "@/lib/security/audit";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await context.params;
  if (!(await canManageTeam(session.user, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const userId = String(body.userId ?? "");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const team = await db.companyTeam.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const rep = await db.user.findFirst({
    where: { id: userId, role: "REP", companyId: team.companyId },
  });
  if (!rep) {
    return NextResponse.json({ error: "Rep not found in company" }, { status: 400 });
  }

  const member = await db.companyTeamMember.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId },
    update: {},
  });

  await logPermissionChange({
    targetUserId: userId,
    changedById: session.user.id,
    changeType: "TEAM_MEMBERSHIP_CHANGED",
    beforeState: { teamId: null, permissionLayer: "team_management" },
    afterState: { teamId, teamName: team.name, role: "member" },
    reason: "Added to team",
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await context.params;
  if (!(await canManageTeam(session.user, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await db.companyTeamMember.deleteMany({ where: { teamId, userId } });

  await logPermissionChange({
    targetUserId: userId,
    changedById: session.user.id,
    changeType: "TEAM_MEMBERSHIP_CHANGED",
    beforeState: { teamId, permissionLayer: "team_management" },
    afterState: { teamId: null },
    reason: "Removed from team",
  });

  return NextResponse.json({ ok: true });
}
