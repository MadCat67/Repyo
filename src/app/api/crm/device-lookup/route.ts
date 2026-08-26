import { auth } from "@/lib/auth";
import { lookupPatientDevice } from "@/lib/salesforce";
import { deviceLookupSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !["PROVIDER", "REP"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = deviceLookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await lookupPatientDevice(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/crm/device-lookup error:", error);
    return NextResponse.json({ error: "Device lookup failed" }, { status: 500 });
  }
}
