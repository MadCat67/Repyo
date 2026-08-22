import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayName } from "@/lib/rep-availability";
import {
  createAvailabilityBlockSchema,
  updateScheduleRulesSchema,
} from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const [yearStr, monthStr] = (month ?? "").split("-");
  const year = Number(yearStr) || new Date().getFullYear();
  const monthIndex = Number(monthStr) - 1 || new Date().getMonth();

  const rangeStart = new Date(year, monthIndex, 1);
  const rangeEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const [rules, blocks, requests, profile] = await Promise.all([
    db.repScheduleRule.findMany({
      where: { repProfileId: session.user.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    db.repAvailabilityBlock.findMany({
      where: {
        repProfileId: session.user.id,
        startAt: { lte: rangeEnd },
        endAt: { gte: rangeStart },
      },
      orderBy: { startAt: "asc" },
    }),
    db.serviceRequest.findMany({
      where: {
        assignedRepId: session.user.id,
        scheduledAt: { gte: rangeStart, lte: rangeEnd },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        facilityName: true,
        procedureType: true,
        scheduledAt: true,
        status: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.repProfile.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    }),
  ]);

  return NextResponse.json({
    rules: rules.map((r) => ({
      ...r,
      dayLabel: dayName(r.dayOfWeek),
    })),
    blocks,
    requests,
    status: profile?.status ?? "OFF_DUTY",
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateScheduleRulesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await db.$transaction([
    db.repScheduleRule.deleteMany({ where: { repProfileId: session.user.id } }),
    ...(parsed.data.rules.length > 0
      ? [
          db.repScheduleRule.createMany({
            data: parsed.data.rules.map((r) => ({
              repProfileId: session.user.id,
              dayOfWeek: r.dayOfWeek,
              startTime: r.startTime,
              endTime: r.endTime,
            })),
          }),
        ]
      : []),
  ]);

  const rules = await db.repScheduleRule.findMany({
    where: { repProfileId: session.user.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({
    rules: rules.map((r) => ({ ...r, dayLabel: dayName(r.dayOfWeek) })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAvailabilityBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const block = await db.repAvailabilityBlock.create({
    data: {
      repProfileId: session.user.id,
      type: parsed.data.type,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      note: parsed.data.note,
    },
  });

  return NextResponse.json(block, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.repAvailabilityBlock.deleteMany({
    where: { id, repProfileId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
