import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findEligibleReps } from "@/lib/routing-engine";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const product = searchParams.get("product") || undefined;
  const facilityLat = searchParams.get("facilityLat");
  const facilityLng = searchParams.get("facilityLng");
  const facilityState = searchParams.get("facilityState") || undefined;
  const facilityZip = searchParams.get("facilityZip") || undefined;
  const scheduledAtParam = searchParams.get("scheduledAt");

  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const scheduledAt = scheduledAtParam ? new Date(scheduledAtParam) : new Date();

  try {
    const eligible = await findEligibleReps({
      companyId,
      facilityName: "",
      product: product || null,
      facilityLat: facilityLat ? Number(facilityLat) : null,
      facilityLng: facilityLng ? Number(facilityLng) : null,
      facilityState: facilityState || null,
      facilityZip: facilityZip || null,
      scheduledAt,
    });

    if (eligible.length === 0) {
      return NextResponse.json([]);
    }

    const reps = await db.user.findMany({
      where: { id: { in: eligible.map((r) => r.userId) } },
      select: {
        id: true,
        name: true,
        phone: true,
        company: { select: { name: true } },
        repProfile: {
          select: {
            products: true,
            status: true,
            credentialStatus: true,
            territories: {
              select: { state: true, county: true, zipCode: true },
            },
          },
        },
      },
    });

    const byId = new Map(reps.map((r) => [r.id, r]));

    const result = eligible.map((e) => {
      const rep = byId.get(e.userId);
      return {
        id: e.userId,
        name: e.name,
        phone: e.phone,
        companyName: rep?.company?.name ?? "",
        products: rep?.repProfile?.products ?? [],
        status: rep?.repProfile?.status ?? "AVAILABLE",
        territories: rep?.repProfile?.territories ?? [],
        locationSharing: e.locationSharing,
        distanceMiles: e.locationSharing && e.distanceMiles > 0 ? e.distanceMiles : null,
        etaMinutes: e.locationSharing && e.etaMinutes > 0 ? e.etaMinutes : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/reps/available error:", error);
    return NextResponse.json({ error: "Failed to load reps" }, { status: 500 });
  }
}
