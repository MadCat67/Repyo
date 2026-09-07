import { db } from "@/lib/db";
import { logPermissionChange } from "@/lib/security/audit";
import type {
  CalendarVisibilitySource,
  TeamCalendarVisibility,
} from "@prisma/client";

export async function applyTeamDefaultsOnAssignment(
  requestId: string,
  repUserId: string
) {
  const team = await db.companyTeamMember.findFirst({
    where: { userId: repUserId },
    include: { team: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!team) return;

  await db.serviceRequest.update({
    where: { id: requestId },
    data: {
      teamId: team.teamId,
      teamCalendarVisibility: team.team.defaultCalendarVisibility,
      calendarVisibilitySource: "TEAM_DEFAULT",
      calendarVisibilitySetAt: new Date(),
    },
  });
}

export async function updateCalendarVisibility(params: {
  requestId: string;
  visibility: TeamCalendarVisibility;
  changedById: string;
  targetRepId: string;
  source: CalendarVisibilitySource;
  reason?: string;
  /** Reps may only set peer visibility preferences, never hide from managers. */
  isRepPreference?: boolean;
}) {
  const existing = await db.serviceRequest.findUnique({
    where: { id: params.requestId },
    select: {
      teamCalendarVisibility: true,
      calendarVisibilitySource: true,
      assignedRepId: true,
    },
  });

  if (!existing) throw new Error("Assignment not found");

  const before = {
    teamCalendarVisibility: existing.teamCalendarVisibility,
    calendarVisibilitySource: existing.calendarVisibilitySource,
  };

  await db.serviceRequest.update({
    where: { id: params.requestId },
    data: {
      teamCalendarVisibility: params.visibility,
      calendarVisibilitySource: params.source,
      calendarVisibilitySetById: params.changedById,
      calendarVisibilitySetAt: new Date(),
    },
  });

  await logPermissionChange({
    targetUserId: params.targetRepId,
    changedById: params.changedById,
    changeType: "CALENDAR_VISIBILITY_CHANGED",
    beforeState: {
      ...before,
      requestId: params.requestId,
      permissionLayer: "calendar_visibility",
    },
    afterState: {
      teamCalendarVisibility: params.visibility,
      calendarVisibilitySource: params.source,
      requestId: params.requestId,
      permissionLayer: "calendar_visibility",
      repPreferenceOnly: params.isRepPreference ?? false,
    },
    reason:
      params.reason ??
      (params.isRepPreference
        ? "Rep updated team calendar peer visibility"
        : "Manager updated calendar visibility"),
  });
}

export async function updateTeamDefaultPolicy(
  teamId: string,
  visibility: TeamCalendarVisibility,
  changedById: string,
  managerUserId: string,
  reason?: string
) {
  const team = await db.companyTeam.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  const before = { defaultCalendarVisibility: team.defaultCalendarVisibility };

  await db.companyTeam.update({
    where: { id: teamId },
    data: { defaultCalendarVisibility: visibility },
  });

  await logPermissionChange({
    targetUserId: managerUserId,
    changedById,
    changeType: "CALENDAR_VISIBILITY_CHANGED",
    beforeState: {
      ...before,
      teamId,
      scope: "team_default_policy",
      permissionLayer: "calendar_visibility",
    },
    afterState: {
      defaultCalendarVisibility: visibility,
      teamId,
      scope: "team_default_policy",
      permissionLayer: "calendar_visibility",
    },
    reason: reason ?? "Team default calendar sharing policy updated",
  });
}
