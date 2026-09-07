import { auth } from "@/lib/auth";
import { canActAsAdminForRequest } from "@/lib/admin-matching";
import { getDelegatedAdminIdsForRep } from "@/lib/admin-matching";
import { db } from "@/lib/db";
import { assignRepToRequest, realtimeBus } from "@/lib/routing-engine";
import {
  GENERIC_NOTIFICATION,
  logPhiAccess,
  logRoutingEvent,
  safeStatusNote,
} from "@/lib/security/audit";
import { checkRequestAccessible } from "@/lib/security/kill-switch";
import { requireAuth, isAuthError } from "@/lib/security/require-auth";
import {
  getProviderOrgContext,
  sanitizeRequestForUser,
  toSessionUser,
} from "@/lib/security/sanitize-request";
import { canAccessRequestRecord } from "@/lib/security/authorization";
import { assignRepSchema, updateRequestStatusSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const user = authResult.user;

  const { id } = await context.params;

  const accessible = await checkRequestAccessible(id);
  if (!accessible) {
    return NextResponse.json({ error: "Request unavailable" }, { status: 403 });
  }

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
      routingEvents: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!serviceRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const delegatedAdminIds =
    user.role === "REP" ? await getDelegatedAdminIdsForRep(user.id) : [];

  const canAccess = canAccessRequestRecord(user, serviceRequest, {
    delegatedAdminIds,
  });
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isDelegatedAdmin =
    user.role === "REP" &&
    Boolean(
      serviceRequest.assignedAdminId &&
        delegatedAdminIds.includes(serviceRequest.assignedAdminId)
    );

  const sanitized = sanitizeRequestForUser(serviceRequest, user, {
    isDelegatedAdmin,
  });

  const orgId = await getProviderOrgContext(user.id);
  await logPhiAccess({
    requestId: id,
    userId: user.id,
    userRole: user.role,
    accessType: "REQUEST_OPENED",
    organizationId: orgId,
    companyId: serviceRequest.companyId,
  });

  const phiVisible =
    "patientName" in sanitized && sanitized.patientName
      ? true
      : "deviceName" in sanitized && sanitized.deviceName
        ? true
        : "deviceSerial" in sanitized && sanitized.deviceSerial
          ? true
          : false;
  if (phiVisible) {
    await logPhiAccess({
      requestId: id,
      userId: user.id,
      userRole: user.role,
      accessType: "PHI_DISPLAYED",
      organizationId: orgId,
      companyId: serviceRequest.companyId,
      metadata: {
        fields: [
          "patientName" in sanitized && sanitized.patientName ? "patient" : null,
          "deviceName" in sanitized && sanitized.deviceName ? "device" : null,
        ].filter(Boolean),
      },
    });
    await logRoutingEvent({
      requestId: id,
      eventType: "REP_OPENED_REQUEST",
      actorId: user.id,
      actorRole: user.role,
      organizationId: orgId,
      companyId: serviceRequest.companyId,
    });
  }

  return NextResponse.json({
    ...sanitized,
    routingHistory: serviceRequest.routingEvents,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const sessionUser = authResult.user;

  const { id } = await context.params;
  const body = await request.json();

  if (body.repId) {
    return handleAssignRep(sessionUser, id, body);
  }

  const parsed = updateRequestStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isRep = sessionUser.role === "REP" && existing.assignedRepId === sessionUser.id;
  const isProvider =
    sessionUser.role === "PROVIDER" && existing.providerId === sessionUser.id;
  const isSuperAdmin = sessionUser.role === "SUPER_ADMIN";
  const canActAsAdmin = await canActAsAdminForRequest(
    sessionUser.id,
    sessionUser.role,
    existing.assignedAdminId
  );

  const { status, lat, lng, note } = parsed.data;

  if (status === "ACCEPTED" && existing.status === "REQUESTING") {
    if (!canActAsAdmin && !isSuperAdmin && !isRep) {
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
      data: {
        requestId: id,
        status,
        lat,
        lng,
        note: note ? safeStatusNote(note) : null,
      },
    });

    if (status === "ACCEPTED" || status === "EN_ROUTE") {
      if (existing.providerId) {
        await tx.notification.create({
          data: {
            userId: existing.providerId,
            title: GENERIC_NOTIFICATION.statusUpdate.title,
            body: GENERIC_NOTIFICATION.statusUpdate.body,
            type: "REQUEST_STATUS",
            data: { requestId: id, status },
          },
        });
      }
    }

    return req;
  });

  if (status === "ACCEPTED") {
    await logRoutingEvent({
      requestId: id,
      eventType: "REP_ACCEPTED",
      actorId: sessionUser.id,
      actorRole: sessionUser.role,
      companyId: existing.companyId,
    });
  }

  realtimeBus.emit("request:updated", { requestId: id });
  if (existing.providerId) {
    realtimeBus.emit(`user:${existing.providerId}`, {
      type: "REQUEST_STATUS",
      requestId: id,
    });
  }

  return NextResponse.json(updated);
}

async function handleAssignRep(
  user: ReturnType<typeof toSessionUser>,
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

  const result = await assignRepToRequest(
    requestId,
    parsed.data.repId,
    {
      companyId: existing.companyId,
      facilityName: existing.facilityName,
      facilityLat: existing.facilityLat,
      facilityLng: existing.facilityLng,
      facilityZip: existing.facilityZipCode,
      product: existing.product,
      scheduledAt: existing.scheduledAt,
    },
    { id: user.id, role: user.role }
  );

  if (!result.assigned) {
    return NextResponse.json(
      { error: result.error ?? "Rep not found or unavailable" },
      { status: 400 }
    );
  }

  return NextResponse.json({ assigned: true, repName: result.repName });
}
