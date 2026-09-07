import { auth } from "@/lib/auth";
import {
  findOrCreateHealthcareSite,
  searchHealthcareSites,
} from "@/lib/healthcare-sites/service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const state = searchParams.get("state") ?? undefined;
  const organizationId = searchParams.get("organizationId") ?? undefined;

  const sites = await searchHealthcareSites({
    q,
    state,
    organizationId,
    limit: Number(searchParams.get("limit") ?? 20),
  });

  return NextResponse.json(sites);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "").trim();
  const state = String(body.state ?? "").trim();
  const zipCode = String(body.zipCode ?? "").trim();

  if (!name || !address || !city || !state || !zipCode) {
    return NextResponse.json(
      { error: "Name, address, city, state, and zip code are required" },
      { status: 400 }
    );
  }

  const site = await findOrCreateHealthcareSite(
    {
      name,
      address,
      city,
      state,
      zipCode,
      phone: body.phone,
      lat: body.lat != null ? Number(body.lat) : null,
      lng: body.lng != null ? Number(body.lng) : null,
      siteType: body.siteType,
    },
    {
      createdById: session.user.id,
      status: session.user.role === "SUPER_ADMIN" ? "ACTIVE" : "PENDING_REVIEW",
    }
  );

  return NextResponse.json(site, { status: 201 });
}
