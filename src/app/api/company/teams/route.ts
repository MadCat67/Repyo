import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canManageTeam,
  getManagedTeamIds,
} from "@/lib/teams/authorization";
import { logPermissionChange } from "@/lib/security/audit";
import { hasAdminPermission, ADMIN_PERMISSIONS } from "@/lib/security/authorization";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (
    !session?.user?.id ||
    session.user.role !== "COMPANY_ADMIN" ||
    !session.user.companyId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll =
    hasAdminPermission(session.user, ADMIN_PERMISSIONS.MANAGE_TEAMS) ||
    hasAdminPermission(session.user, ADMIN_PERMISSIONS.VIEW_TEAM_CALENDAR);

  const managedIds = await getManagedTeamIds(session.user);

  const teams = await db.companyTeam.findMany({
    where: {
      companyId: session.user.companyId,
      ...(canViewAll || managedIds.length === 0
        ? {}
        : { id: { in: managedIds } }),
    },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              repProfile: { select: { status: true, credentialStatus: true } },
            },
          },
        },
      },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      defaultCalendarVisibility: t.defaultCalendarVisibility,
      manager: t.manager,
      memberCount: t.members.length,
      assignmentCount: t._count.assignments,
      members: t.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        status: m.user.repProfile?.status ?? "OFF_DUTY",
        credentialStatus: m.user.repProfile?.credentialStatus ?? "PENDING",
      })),
      isManager: t.managerUserId === session.user.id,
    })),
    canManageTeams: hasAdminPermission(session.user, ADMIN_PERMISSIONS.MANAGE_TEAMS),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (
    !session?.user?.id ||
    session.user.role !== "COMPANY_ADMIN" ||
    !session.user.companyId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAdminPermission(session.user, ADMIN_PERMISSIONS.MANAGE_TEAMS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const managerUserId = String(body.managerUserId ?? session.user.id);
  const defaultCalendarVisibility =
    body.defaultCalendarVisibility === "HIDDEN_FROM_TEAM_PEERS"
      ? "HIDDEN_FROM_TEAM_PEERS"
      : "SHARED_WITH_TEAM";

  if (!name) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  const manager = await db.user.findFirst({
    where: {
      id: managerUserId,
      companyId: session.user.companyId,
      role: { in: ["COMPANY_ADMIN", "REP"] },
    },
  });
  if (!manager) {
    return NextResponse.json({ error: "Invalid team manager" }, { status: 400 });
  }

  const team = await db.companyTeam.create({
    data: {
      companyId: session.user.companyId,
      name,
      managerUserId,
      defaultCalendarVisibility,
    },
  });

  await logPermissionChange({
    targetUserId: managerUserId,
    changedById: session.user.id,
    changeType: "TEAM_MEMBERSHIP_CHANGED",
    beforeState: { teamId: null },
    afterState: {
      teamId: team.id,
      teamName: name,
      role: "manager",
      permissionLayer: "team_management",
    },
    reason: "Team created",
  });

  return NextResponse.json(team, { status: 201 });
}
