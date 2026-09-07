import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.companyTeamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: {
          manager: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    teams: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      defaultCalendarVisibility: m.team.defaultCalendarVisibility,
      manager: m.team.manager,
      members: m.team.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
      })),
    })),
  });
}
