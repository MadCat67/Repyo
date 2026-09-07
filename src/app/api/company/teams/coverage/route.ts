import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayName } from "@/lib/rep-availability";
import {
  canManageTeam,
  canViewOnTeamCalendar,
  getManagedTeamIds,
} from "@/lib/teams/authorization";
import { hasAdminPermission, ADMIN_PERMISSIONS } from "@/lib/security/authorization";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.user.role !== "COMPANY_ADMIN" &&
    session.user.role !== "REP"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");
  const month = searchParams.get("month");
  const [yearStr, monthStr] = (month ?? "").split("-");
  const year = Number(yearStr) || new Date().getFullYear();
  const monthIndex = Number(monthStr) - 1 || new Date().getMonth();
  const rangeStart = new Date(year, monthIndex, 1);
  const rangeEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  let teamIds: string[] = [];
  if (teamId) {
    if (session.user.role === "COMPANY_ADMIN") {
      const allowed = await getManagedTeamIds(session.user);
      const canViewAll =
        hasAdminPermission(session.user, ADMIN_PERMISSIONS.VIEW_TEAM_CALENDAR) ||
        hasAdminPermission(session.user, ADMIN_PERMISSIONS.MANAGE_TEAMS);
      if (!canViewAll && !allowed.includes(teamId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const member = await db.companyTeamMember.findFirst({
        where: { teamId, userId: session.user.id },
      });
      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    teamIds = [teamId];
  } else if (session.user.role === "COMPANY_ADMIN") {
    teamIds = await getManagedTeamIds(session.user);
  } else {
    const memberships = await db.companyTeamMember.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    });
    teamIds = memberships.map((m) => m.teamId);
  }

  if (teamIds.length === 0) {
    return NextResponse.json({ teams: [], month: month ?? null });
  }

  const teams = await db.companyTeam.findMany({
    where: { id: { in: teamIds }, companyId: session.user.companyId },
    include: {
      manager: { select: { id: true, name: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              repProfile: {
                select: {
                  status: true,
                  scheduleRules: { orderBy: { dayOfWeek: "asc" } },
                  availabilityBlocks: {
                    where: {
                      startAt: { lte: rangeEnd },
                      endAt: { gte: rangeStart },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const memberIds = teams.flatMap((t) => t.members.map((m) => m.user.id));

  const requests =
    memberIds.length > 0
      ? await db.serviceRequest.findMany({
          where: {
            companyId: session.user.companyId,
            assignedRepId: { in: memberIds },
            scheduledAt: { gte: rangeStart, lte: rangeEnd },
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            assignedRepId: true,
            facilityName: true,
            procedureType: true,
            scheduledAt: true,
            status: true,
            urgency: true,
            teamCalendarVisibility: true,
            calendarVisibilitySource: true,
            teamId: true,
          },
          orderBy: { scheduledAt: "asc" },
        })
      : [];

  const isManagerForTeam = async (tid: string) =>
    session.user.role === "COMPANY_ADMIN" &&
    (await canManageTeam(session.user, tid));

  const result = [];
  for (const team of teams) {
    const managerView = await isManagerForTeam(team.id);
    const repIds = team.members.map((m) => m.user.id);

    const visibleRequests = requests.filter((req) => {
      if (!req.assignedRepId || !repIds.includes(req.assignedRepId)) return false;
      return canViewOnTeamCalendar(session.user, req, {
        isManager: managerView,
        isAssignedRep: req.assignedRepId === session.user.id,
      });
    });

    const coverageGaps: { date: string; reason: string }[] = [];
    if (managerView) {
      for (const member of team.members) {
        const rep = member.user;
        const repRequests = requests.filter(
          (r) => r.assignedRepId === rep.id
        );
        for (const req of repRequests) {
          const status = rep.repProfile?.status ?? "OFF_DUTY";
          const onVacation = (rep.repProfile?.availabilityBlocks ?? []).some(
            (b) =>
              new Date(b.startAt) <= new Date(req.scheduledAt) &&
              new Date(b.endAt) > new Date(req.scheduledAt)
          );
          if (status === "OFF_DUTY" || status === "VACATION" || onVacation) {
            coverageGaps.push({
              date: req.scheduledAt.toISOString(),
              reason: `${rep.name} assigned but ${onVacation ? "on time off" : status.toLowerCase().replace("_", " ")}`,
            });
          }
        }
        if (statusIndicatesGap(rep.repProfile?.status) && repRequests.length === 0) {
          coverageGaps.push({
            date: rangeStart.toISOString(),
            reason: `${rep.name} is ${rep.repProfile?.status?.toLowerCase().replace("_", " ")} with no backup visible this month`,
          });
        }
      }
    }

    result.push({
      id: team.id,
      name: team.name,
      defaultCalendarVisibility: team.defaultCalendarVisibility,
      manager: team.manager,
      isManager: managerView,
      members: team.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        status: m.user.repProfile?.status ?? "OFF_DUTY",
        rules: (m.user.repProfile?.scheduleRules ?? []).map((r) => ({
          ...r,
          dayLabel: dayName(r.dayOfWeek),
        })),
        blocks: m.user.repProfile?.availabilityBlocks ?? [],
        assignments: requests
          .filter((r) => r.assignedRepId === m.user.id)
          .map((r) => ({
            ...r,
            scheduledAt: r.scheduledAt.toISOString(),
            visibleToPeers: canViewOnTeamCalendar(session.user, r, {
              isManager: true,
              isAssignedRep: false,
            }),
            managerAlwaysVisible: true,
          })),
      })),
      sharedAssignments: visibleRequests.map((r) => ({
        ...r,
        scheduledAt: r.scheduledAt.toISOString(),
        repName:
          team.members.find((m) => m.user.id === r.assignedRepId)?.user.name ??
          "",
      })),
      coverageGaps: coverageGaps.slice(0, 20),
    });
  }

  return NextResponse.json({
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    teams: result,
  });
}

function statusIndicatesGap(status?: string) {
  return status === "OFF_DUTY" || status === "VACATION";
}
