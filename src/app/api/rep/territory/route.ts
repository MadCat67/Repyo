import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTerritorySchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const territories = await db.territory.findMany({
    where: { repProfileId: session.user.id },
    include: { facility: true },
  });

  return NextResponse.json(territories);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateTerritorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await db.$transaction([
    db.territory.deleteMany({ where: { repProfileId: session.user.id } }),
    ...parsed.data.territories.map((t) =>
      db.territory.create({
        data: {
          repProfileId: session.user.id,
          state: t.state || null,
          county: t.county || null,
          zipCode: t.zipCode || null,
        },
      })
    ),
  ]);

  const territories = await db.territory.findMany({
    where: { repProfileId: session.user.id },
  });

  return NextResponse.json(territories);
}
