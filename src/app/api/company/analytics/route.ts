import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company assigned" }, { status: 400 });
  }

  const requests = await db.serviceRequest.findMany({
    where: { companyId },
    include: {
      assignedRep: { select: { name: true } },
      statusLogs: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const completed = requests.filter((r) => r.status === "COMPLETED");
  const cancelled = requests.filter((r) => r.status === "CANCELLED");
  const active = requests.filter(
    (r) => !["COMPLETED", "CANCELLED"].includes(r.status)
  );

  const responseTimes: number[] = [];
  for (const req of completed) {
    const assigned = req.statusLogs.find((l) => l.status === "REQUESTING");
    const accepted = req.statusLogs.find((l) => l.status === "ACCEPTED");
    if (assigned && accepted) {
      responseTimes.push(
        (accepted.createdAt.getTime() - assigned.createdAt.getTime()) / 60000
      );
    }
  }

  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  const byProcedure: Record<string, number> = {};
  for (const req of requests) {
    const key = req.procedureType ?? "Unspecified";
    byProcedure[key] = (byProcedure[key] ?? 0) + 1;
  }

  const byUrgency: Record<string, number> = {};
  for (const req of requests) {
    byUrgency[req.urgency] = (byUrgency[req.urgency] ?? 0) + 1;
  }

  const reps = await db.repProfile.findMany({
    where: { user: { companyId } },
    select: { status: true, credentialStatus: true },
  });

  const availableReps = reps.filter((r) => r.status === "AVAILABLE").length;
  const credentialedReps = reps.filter((r) => r.credentialStatus === "ACTIVE").length;

  const forwards = await db.requestForward.findMany({
    where: { request: { companyId } },
    include: {
      originalRep: { select: { id: true, name: true } },
      forwardedTo: { select: { id: true, name: true } },
    },
    orderBy: { forwardTimestamp: "desc" },
    take: 500,
  });

  const forwardPairs: Record<string, number> = {};
  for (const forward of forwards) {
    const key = `${forward.originalRep.name} → ${forward.forwardedTo.name}`;
    forwardPairs[key] = (forwardPairs[key] ?? 0) + 1;
  }

  return NextResponse.json({
    totals: {
      all: requests.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      forwards: forwards.length,
    },
    avgResponseMinutes,
    byProcedure: Object.entries(byProcedure)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    byUrgency: Object.entries(byUrgency).map(([name, count]) => ({ name, count })),
    coverage: {
      totalReps: reps.length,
      availableReps,
      credentialedReps,
    },
    forwardRoutes: Object.entries(forwardPairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([route, count]) => ({ route, count })),
  });
}
