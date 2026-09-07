import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/security/authorization";
import { toSessionUser } from "@/lib/security/sanitize-request";

export async function requireAuth(): Promise<
  { user: SessionUser } | NextResponse
> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.role) {
    return NextResponse.json({ error: "Session revoked" }, { status: 401 });
  }
  return {
    user: toSessionUser({
      id: session.user.id,
      role: session.user.role,
      companyId: session.user.companyId,
      accountState: session.user.accountState,
      adminPermissions: session.user.adminPermissions,
    }),
  };
}

export function isAuthError(
  result: { user: SessionUser } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
