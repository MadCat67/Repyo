import { auth } from "@/lib/auth";
import { canActAsAdminForRequest } from "@/lib/admin-matching";
import { db } from "@/lib/db";
import { decryptPHI, decryptDate } from "@/lib/encryption";
import { assignRepToRequest, realtimeBus } from "@/lib/routing-engine";
import { assignRepSchema, updateRequestStatusSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const serviceRequest = await db.serviceRequest.findUnique({
    where: { id },
    include: {
      provider: { select: { id: true, name: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true } },
      assignedRep: {
        select: {
          id: true,
          name: true,
          phone: true,
          repProfile: { select: { lat: true, lng: true, status: true } },
        },
      },
      company: { select: { id: true, name: true } },
      statusLogs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!serviceRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...serviceRequest,
    patientName: decryptPHI(serviceRequest.patientNameEnc),
    patientDOB: decryptDate(serviceRequest.patientDOBEnc).toISOString(),
    patientNameEnc: undefined,
    patientDOBEnc: undefined,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  if (body.repId) {
    return handleAssignRep(session.user, id, body);
  }

  const parsed = updateRequestStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isRep = session.user.role === "REP" && existing.assignedRepId === session.user.id;
  const isProvider =
    session.user.role === "PROVIDER" && existing.providerId === session.user.id;
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const canActAsAdmin = await canActAsAdminForRequest(
    session.user.id,
    session.user.role,
    existing.assignedAdminId
  );

  const { status, lat, lng, note } = parsed.data;

  if (status === "ACCEPTED" && existing.status === "REQUESTING") {
    if (!canActAsAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (status === "CANCELLED" && isProvider) {
    // provider can cancel
  } else if (isRep) {
    if (!["ACCEPTED", "EN_ROUTE", "ARRIVED", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (canActAsAdmin && status === "CANCELLED") {
    // admin/delegated rep can cancel
  } else if (!isProvider && !isRep && !isSuperAdmin && !canActAsAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.$transaction(async (tx) => {
    const req = await tx.serviceRequest.update({
      where: { id },
      data: {
        status,
        ...(lat != null && { repLat: lat }),
        ...(lng != null && { repLng: lng }),
      },
    });

    await tx.requestStatusLog.create({
      data: { requestId: id, status, lat, lng, note },
    });

    if (status === "ACCEPTED" || status === "EN_ROUTE") {
      await tx.notification.create({
        data: {
          userId: existing.providerId,
          title: `Request ${status === "ACCEPTED" ? "Accepted" : "En Route"}`,
          body: `${session.user.name} updated request status to ${status.replace("_", " ").toLowerCase()}`,
          type: "REQUEST_STATUS",
          data: { requestId: id, status },
        },
      });
    }

    return req;
  });

  realtimeBus.emit("request:updated", { requestId: id });
  realtimeBus.emit(`user:${existing.providerId}`, { type: "REQUEST_STATUS", requestId: id });

  return NextResponse.json(updated);
}

async function handleAssignRep(
  user: { id: string; role: string },
  requestId: string,
  body: unknown
) {
  const parsed = assignRepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const existing = await db.serviceRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canAssign = await canActAsAdminForRequest(
    user.id,
    user.role,
    existing.assignedAdminId
  );

  if (!canAssign && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await assignRepToRequest(requestId, parsed.data.repId, {
    companyId: existing.companyId,
    facilityName: existing.facilityName,
    facilityLat: existing.facilityLat,
    facilityLng: existing.facilityLng,
    facilityZip: existing.facilityZipCode,
    product: existing.product,
  });

  if (!result.assigned) {
    return NextResponse.json({ error: "Rep not found or unavailable" }, { status: 400 });
  }

  return NextResponse.json({ assigned: true, repName: result.repName });
}
