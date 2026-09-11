import { requireAuth, isAuthError } from "@/lib/security/require-auth";
import {
  FORWARDABLE_REQUEST_STATUSES,
  getForwardTargets,
} from "@/lib/request-forwarding";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const user = authResult.user;

  if (user.role !== "REP") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const request = await db.serviceRequest.findUnique({
    where: { id },
    select: {
      assignedRepId: true,
      status: true,
      acknowledgedAt: true,
      company: { select: { forwardEnabled: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    request.assignedRepId !== user.id ||
    !FORWARDABLE_REQUEST_STATUSES.includes(request.status)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!request.company.forwardEnabled) {
    return NextResponse.json({ error: "Forwarding disabled" }, { status: 403 });
  }

  const targets = await getForwardTargets(id, user.id);
  return NextResponse.json(targets);
}
