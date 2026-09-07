import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeInvitation } from "@/lib/invitations/service";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const invitation = await db.platformInvitation.findUnique({
    where: { id },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    invitation.invitedById !== session.user.id &&
    session.user.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await revokeInvitation(id, session.user.id);
  return NextResponse.json({ ok: true });
}
