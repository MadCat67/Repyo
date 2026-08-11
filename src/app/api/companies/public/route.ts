import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Public list of active device companies for signup forms */
export async function GET() {
  const companies = await db.company.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companies);
}
