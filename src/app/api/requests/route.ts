import { auth } from "@/lib/auth";
import { findMatchingAdmin } from "@/lib/admin-matching";
import { db } from "@/lib/db";
import { encryptPHI, encryptDate, decryptPHI, decryptDate } from "@/lib/encryption";
import { getDelegatedAdminIdsForRep } from "@/lib/admin-matching";
import { assignRepToRequest, findEligibleReps } from "@/lib/routing-engine";
import { createRequestSchema } from "@/lib/validations";
import { RequestUrgency } from "@prisma/client";
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
          { initiatedByRepId: session.user.id },
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
        initiatedByRep: { select: { id: true, name: true, phone: true } },
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
        patientRoomEnc: undefined,
      };

      if (session.user.role === "PROVIDER") {
        return {
          ...base,
          patientName: r.patientNameEnc ? decryptPHI(r.patientNameEnc) : null,
          patientDOB: r.patientDOBEnc
            ? decryptDate(r.patientDOBEnc).toISOString()
            : null,
          patientRoom: r.patientRoomEnc ? decryptPHI(r.patientRoomEnc) : null,
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
  if (
    !session?.user?.id ||
    !["PROVIDER", "REP"].includes(session.user.role)
  ) {
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
    const isRepInitiated =
      session.user.role === "REP" || Boolean(data.repInitiated);

    if (isRepInitiated && session.user.role !== "REP") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dob =
      data.patientDOB && data.patientDOB.length === 10
        ? new Date(`${data.patientDOB}T00:00:00.000Z`)
        : data.patientDOB
          ? new Date(data.patientDOB)
          : null;

    const providerProfile =
      session.user.role === "PROVIDER"
        ? await db.providerProfile.findUnique({
            where: { userId: session.user.id },
          })
        : null;

    const zipCode = data.facilityZipCode.slice(0, 5);
    const matchedAdmin = await findMatchingAdmin(data.companyId, zipCode);

    const urgency: RequestUrgency =
      data.urgency ??
      (() => {
        const scheduled = new Date(data.scheduledAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const day = new Date(scheduled);
        day.setHours(0, 0, 0, 0);
        return day.getTime() === today.getTime() ? "ASAP" : "SCHEDULED";
      })();

    const assignRepId = isRepInitiated
      ? data.assignRepId ?? data.preferredRepId ?? null
      : data.preferredRepId ?? null;

    const scheduledAt = new Date(data.scheduledAt);
    const routingCriteria = {
      companyId: data.companyId,
      facilityName: data.facilityName,
      facilityLat: data.facilityLat,
      facilityLng: data.facilityLng,
      facilityZip: zipCode,
      product: data.product,
      scheduledAt,
    };

    if (assignRepId) {
      const eligible = await findEligibleReps({
        ...routingCriteria,
        preferredRepId: assignRepId,
      });
      if (!eligible.some((r) => r.userId === assignRepId)) {
        return NextResponse.json(
          {
            error:
              "Selected rep is not available at the scheduled date and time",
          },
          { status: 400 }
        );
      }
    }

    const serviceRequest = await db.serviceRequest.create({
      data: {
        providerId: session.user.role === "PROVIDER" ? session.user.id : null,
        initiatedByRepId: isRepInitiated ? session.user.id : null,
        companyId: data.companyId,
        assignedAdminId: matchedAdmin?.id ?? null,
        assignedRepId: assignRepId,
        facilityName: data.facilityName,
        facilityAddr: data.facilityAddr,
        facilityPhone: data.facilityPhone,
        facilityContactName: data.facilityContactName,
        facilityContactPhone: data.facilityContactPhone,
        facilityLat: data.facilityLat,
        facilityLng: data.facilityLng,
        facilityZipCode: zipCode,
        department: data.department,
        requesterName: data.requesterName,
        requesterPhone: data.requesterPhone,
        requesterEmail: data.requesterEmail,
        requesterFax: data.requesterFax,
        patientNameEnc: data.patientName ? encryptPHI(data.patientName) : null,
        patientDOBEnc: dob ? encryptDate(dob) : null,
        patientRoomEnc: data.patientRoom ? encryptPHI(data.patientRoom) : null,
        procedureType: data.procedureType ?? null,
        requestType: data.requestType,
        product: data.product,
        urgency,
        scheduledAt,
        notes: data.notes,
        status: isRepInitiated && assignRepId ? "ACCEPTED" : "REQUESTING",
      },
    });

    const repNote = assignRepId
      ? isRepInitiated
        ? "Rep-initiated request assigned on creation"
        : "Provider requested a specific rep"
      : null;

    await db.requestStatusLog.create({
      data: {
        requestId: serviceRequest.id,
        status: serviceRequest.status,
        note:
          repNote ??
          (matchedAdmin
            ? `Routed to admin ${matchedAdmin.name} for zip ${zipCode}`
            : "Request submitted — awaiting admin assignment"),
      },
    });

    if (providerProfile && session.user.role === "PROVIDER") {
      await db.providerProfile.update({
        where: { userId: session.user.id },
        data: {
          facilityName: data.facilityName,
          facilityAddress: data.facilityAddr,
          facilityContactName: data.facilityContactName,
          facilityContactPhone: data.facilityContactPhone,
          department: data.department ?? providerProfile.department,
          zipCode: zipCode,
          requesterPhone: data.requesterPhone,
          requesterFax: data.requesterFax ?? providerProfile.requesterFax,
        },
      });
    }

    if (assignRepId) {
      const assignResult = await assignRepToRequest(
        serviceRequest.id,
        assignRepId,
        routingCriteria
      );
      if (!assignResult.assigned) {
        await db.serviceRequest.delete({ where: { id: serviceRequest.id } });
        return NextResponse.json(
          { error: assignResult.error ?? "Failed to assign rep" },
          { status: 400 }
        );
      }
    } else {
      const notifyUserId =
        matchedAdmin?.delegationActive && matchedAdmin.delegatedRepId
          ? matchedAdmin.delegatedRepId
          : matchedAdmin?.id;

      if (notifyUserId) {
        await db.notification.create({
          data: {
            userId: notifyUserId,
            title: isRepInitiated ? "Rep-Created Request" : "New Provider Request",
            body: `New request at ${data.facilityName} (zip ${zipCode})`,
            type: "REQUEST_ASSIGNED",
            data: { requestId: serviceRequest.id },
          },
        });
      }
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
