import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateDelegationSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      delegationActive: true,
      delegatedRepId: true,
      zipCodeStart: true,
      zipCodeEnd: true,
      delegatedRep: { select: { id: true, name: true, email: true } },
    },
  });

  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reps = await db.user.findMany({
    where: { role: "REP", companyId: session.user.companyId ?? undefined },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    delegationActive: admin.delegationActive,
    delegatedRep: admin.delegatedRep,
    zipCodeStart: admin.zipCodeStart,
    zipCodeEnd: admin.zipCodeEnd,
    reps,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateDelegationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { repId, active } = parsed.data;

  if (active && !repId) {
    return NextResponse.json(
      { error: "Select a rep to forward requests to" },
      { status: 400 }
    );
  }

  if (repId) {
    const rep = await db.user.findFirst({
      where: {
        id: repId,
        role: "REP",
        companyId: session.user.companyId ?? undefined,
      },
    });

    if (!rep) {
      return NextResponse.json({ error: "Rep not found in your company" }, { status: 400 });
    }
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      delegationActive: active,
      delegatedRepId: active ? repId : null,
    },
    select: {
      delegationActive: true,
      delegatedRep: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(updated);
}
