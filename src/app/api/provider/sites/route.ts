import { auth } from "@/lib/auth";
import { setProviderSites } from "@/lib/healthcare-sites/service";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.providerSiteMembership.findMany({
    where: { userId: session.user.id },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          lat: true,
          lng: true,
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    memberships.map((m) => ({
      ...m.site,
      isPrimary: m.isPrimary,
      jobTitle: m.jobTitle,
      department: m.department,
    }))
  );
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const siteIds = Array.isArray(body.siteIds)
    ? body.siteIds.map(String)
    : [];

  const profile = await db.providerProfile.findUnique({
    where: { userId: session.user.id },
    select: { organizationId: true, department: true, jobTitle: true },
  });

  const memberships = await setProviderSites(session.user.id, siteIds, {
    organizationId: profile?.organizationId,
    primarySiteId: body.primarySiteId ? String(body.primarySiteId) : undefined,
    jobTitle: body.jobTitle ?? profile?.jobTitle,
    department: body.department ?? profile?.department,
  });

  return NextResponse.json(
    memberships.map((m) => ({
      ...m.site,
      isPrimary: m.isPrimary,
    }))
  );
}
