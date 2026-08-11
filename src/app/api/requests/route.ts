import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptPHI, encryptDate, decryptPHI, decryptDate } from "@/lib/encryption";
import { assignRepToRequest } from "@/lib/routing-engine";
import { createRequestSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (session.user.role === "COMPANY_ADMIN" && !session.user.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 403 });
    }

    const where =
      session.user.role === "PROVIDER"
        ? { providerId: session.user.id }
        : session.user.role === "REP"
          ? { assignedRepId: session.user.id }
          : session.user.role === "COMPANY_ADMIN"
            ? { companyId: session.user.companyId ?? undefined }
            : {};

    const requests = await db.serviceRequest.findMany({
      where,
      include: {
        provider: { select: { id: true, name: true, phone: true } },
        assignedRep: { select: { id: true, name: true, phone: true } },
        company: { select: { id: true, name: true } },
        statusLogs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const sanitized = requests.map((r) => {
      const base = {
        ...r,
        patientNameEnc: undefined,
        patientDOBEnc: undefined,
      };

      if (session.user.role === "PROVIDER") {
        return {
          ...base,
          patientName: decryptPHI(r.patientNameEnc),
          patientDOB: decryptDate(r.patientDOBEnc).toISOString(),
        };
      }

      return base;
    });

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("GET /api/requests error:", error);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const dob =
      data.patientDOB.length === 10
        ? new Date(`${data.patientDOB}T00:00:00.000Z`)
        : new Date(data.patientDOB);

    const serviceRequest = await db.serviceRequest.create({
      data: {
        providerId: session.user.id,
        companyId: data.companyId,
        facilityName: data.facilityName,
        facilityAddr: data.facilityAddr,
        facilityPhone: data.facilityPhone,
        facilityLat: data.facilityLat,
        facilityLng: data.facilityLng,
        department: data.department,
        physicianName: data.physicianName,
        patientNameEnc: encryptPHI(data.patientName),
        patientDOBEnc: encryptDate(dob),
        procedureType: data.procedureType,
        requestType: data.requestType,
        product: data.product,
        urgency: data.urgency,
        scheduledAt: new Date(data.scheduledAt),
        notes: data.notes,
      },
    });

    await db.requestStatusLog.create({
      data: {
        requestId: serviceRequest.id,
        status: "SEARCHING",
        note: "Request submitted",
      },
    });

    const assignment = await assignRepToRequest(serviceRequest.id, {
      companyId: data.companyId,
      facilityName: data.facilityName,
      facilityLat: data.facilityLat,
      facilityLng: data.facilityLng,
      product: data.product,
      preferredRepId: data.preferredRepId,
    });

    return NextResponse.json(
      { request: serviceRequest, assignment },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/requests error:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
