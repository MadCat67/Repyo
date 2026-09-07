import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasAdminPermission, ADMIN_PERMISSIONS } from "@/lib/security/authorization";
import { toSessionUser } from "@/lib/security/sanitize-request";
import { updateCompanySchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      forwardEnabled: true,
      forwardTeamMembersOnly: true,
      forwardAllowManagers: true,
    },
  });

  return NextResponse.json(company);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = toSessionUser({
    id: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    adminPermissions: session.user.adminPermissions,
  });

  if (!hasAdminPermission(user, ADMIN_PERMISSIONS.MANAGE_REQUESTS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const data = {
    ...(parsed.data.forwardEnabled !== undefined
      ? { forwardEnabled: parsed.data.forwardEnabled }
      : {}),
    ...(parsed.data.forwardTeamMembersOnly !== undefined
      ? { forwardTeamMembersOnly: parsed.data.forwardTeamMembersOnly }
      : {}),
    ...(parsed.data.forwardAllowManagers !== undefined
      ? { forwardAllowManagers: parsed.data.forwardAllowManagers }
      : {}),
  };

  const company = await db.company.update({
    where: { id: companyId },
    data,
    select: {
      id: true,
      name: true,
      forwardEnabled: true,
      forwardTeamMembersOnly: true,
      forwardAllowManagers: true,
    },
  });

  return NextResponse.json(company);
}
