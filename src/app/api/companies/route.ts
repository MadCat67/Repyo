import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await db.company.findMany({
    where: { active: true },
    select: { id: true, name: true, products: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companies);
}
