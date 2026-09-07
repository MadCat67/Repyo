import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const orgs = await db.providerOrganization.findMany({
    where: { status: { in: ["VERIFIED", "ACTIVATED"] } },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      complianceMode: true,
      facilities: {
        select: {
          id: true,
          name: true,
          address: true,
          zipCode: true,
          department: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(orgs);
}
