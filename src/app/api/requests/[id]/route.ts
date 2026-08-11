import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptPHI, decryptDate } from "@/lib/encryption";
import { realtimeBus } from "@/lib/routing-engine";
import { updateRequestStatusSchema } from "@/lib/validations";
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
  const parsed = updateRequestStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isRep = session.user.role === "REP" && existing.assignedRepId === session.user.id;
  const isProvider = session.user.role === "PROVIDER" && existing.providerId === session.user.id;
  const isAdmin = ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(session.user.role);

  if (!isRep && !isProvider && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, lat, lng, note } = parsed.data;

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
          body: `${session.user.name} updated request status to ${status}`,
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
