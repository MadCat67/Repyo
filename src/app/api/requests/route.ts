import { auth } from "@/lib/auth";
import { findMatchingAdmin } from "@/lib/admin-matching";
import { db } from "@/lib/db";
import { encryptPHI, encryptDate, decryptPHI, decryptDate } from "@/lib/encryption";
import { getDelegatedAdminIdsForRep } from "@/lib/admin-matching";
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

    let where: Record<string, unknown> = {};

    if (session.user.role === "PROVIDER") {
      where = { providerId: session.user.id };
    } else if (session.user.role === "REP") {
      const delegatedAdminIds = await getDelegatedAdminIdsForRep(session.user.id);
      where = {
        OR: [
          { assignedRepId: session.user.id },
          ...(delegatedAdminIds.length > 0
            ? [
                {
                  assignedAdminId: { in: delegatedAdminIds },
                  status: "REQUESTING",
                },
              ]
            : []),
        ],
      };
    } else if (session.user.role === "COMPANY_ADMIN") {
      where = {
        companyId: session.user.companyId ?? undefined,
        assignedAdminId: session.user.id,
      };
    }

    const requests = await db.serviceRequest.findMany({
      where,
      include: {
        provider: { select: { id: true, name: true, phone: true } },
        assignedRep: { select: { id: true, name: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true } },
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

    const providerProfile = await db.providerProfile.findUnique({
      where: { userId: session.user.id },
    });

    const zipCode = data.facilityZipCode.slice(0, 5);
    const matchedAdmin = await findMatchingAdmin(data.companyId, zipCode);

    const serviceRequest = await db.serviceRequest.create({
      data: {
        providerId: session.user.id,
        companyId: data.companyId,
        assignedAdminId: matchedAdmin?.id ?? null,
        facilityName: data.facilityName,
        facilityAddr: data.facilityAddr,
        facilityPhone: data.facilityPhone,
        facilityLat: data.facilityLat,
        facilityLng: data.facilityLng,
        facilityZipCode: zipCode,
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
        status: "REQUESTING",
      },
    });

    await db.requestStatusLog.create({
      data: {
        requestId: serviceRequest.id,
        status: "REQUESTING",
        note: matchedAdmin
          ? `Routed to admin ${matchedAdmin.name} for zip ${zipCode}`
          : "Request submitted — awaiting admin assignment",
      },
    });

    if (providerProfile && !providerProfile.zipCode) {
      await db.providerProfile.update({
        where: { userId: session.user.id },
        data: { zipCode },
      });
    }

    const notifyUserId =
      matchedAdmin?.delegationActive && matchedAdmin.delegatedRepId
        ? matchedAdmin.delegatedRepId
        : matchedAdmin?.id;

    if (notifyUserId) {
      await db.notification.create({
        data: {
          userId: notifyUserId,
          title: "New Provider Request",
          body: `New request at ${data.facilityName} (zip ${zipCode})`,
          type: "REQUEST_ASSIGNED",
          data: { requestId: serviceRequest.id },
        },
      });
    }

    return NextResponse.json(
      {
        request: serviceRequest,
        matchedAdmin: matchedAdmin
          ? { id: matchedAdmin.id, name: matchedAdmin.name }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/requests error:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
