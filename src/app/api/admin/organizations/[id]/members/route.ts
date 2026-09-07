import { auth } from "@/lib/auth";
import {
  grantOrgAdministrator,
  isOrgAdministrator,
  revokeOrgAdministrator,
} from "@/lib/authorization/grants";
import { approveProviderUser } from "@/lib/verification/user-verification";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

async function canManageOrg(
  userId: string,
  role: string,
  organizationId: string
) {
  if (role === "SUPER_ADMIN") return true;
  return isOrgAdministrator(userId, organizationId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId } = await params;

  if (
    !(await canManageOrg(
      session.user.id,
      session.user.role,
      organizationId
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db.providerProfile.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      orgFacility: { select: { id: true, name: true } },
    },
    orderBy: { user: { createdAt: "desc" } },
  });

  const pending = members.filter(
    (m) => m.accountStatus === "PENDING_APPROVAL"
  );

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      jobTitle: m.jobTitle ?? m.department,
      facilityName: m.orgFacility?.name ?? m.facilityName,
      accountStatus: m.accountStatus,
      verificationDecision: m.verificationDecision,
      isOrgAdministrator: m.isOrgAdministrator,
      orgAdminGrantedAt: m.orgAdminGrantedAt,
      createdAt: m.user.createdAt,
    })),
    pendingCount: pending.length,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId } = await params;
  const body = await request.json();
  const targetUserId = String(body.userId ?? "");

  if (
    !(await canManageOrg(
      session.user.id,
      session.user.role,
      organizationId
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "approve") {
    await approveProviderUser(
      targetUserId,
      session.user.id,
      organizationId,
      body.reason
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "grant_org_admin") {
    await grantOrgAdministrator({
      targetUserId,
      grantedById: session.user.id,
      organizationId,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "revoke_org_admin") {
    await revokeOrgAdministrator({
      targetUserId,
      revokedById: session.user.id,
      organizationId,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
