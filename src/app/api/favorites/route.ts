import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await db.favoriteRep.findMany({
    where: { providerId: session.user.id },
    include: {
      rep: {
        select: {
          id: true,
          name: true,
          phone: true,
          company: { select: { name: true } },
          repProfile: {
            select: {
              status: true,
              credentialStatus: true,
              products: true,
              territories: {
                select: { state: true, county: true, zipCode: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites.map((f) => f.rep));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repId } = await request.json();
  if (!repId) {
    return NextResponse.json({ error: "repId required" }, { status: 400 });
  }

  const rep = await db.user.findFirst({ where: { id: repId, role: "REP" } });
  if (!rep) {
    return NextResponse.json({ error: "Rep not found" }, { status: 404 });
  }

  const favorite = await db.favoriteRep.upsert({
    where: {
      providerId_repId: { providerId: session.user.id, repId },
    },
    create: { providerId: session.user.id, repId },
    update: {},
  });

  return NextResponse.json(favorite, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("repId");
  if (!repId) {
    return NextResponse.json({ error: "repId required" }, { status: 400 });
  }

  await db.favoriteRep.deleteMany({
    where: { providerId: session.user.id, repId },
  });

  return NextResponse.json({ success: true });
}
