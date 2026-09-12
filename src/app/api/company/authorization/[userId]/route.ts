import { auth } from "@/lib/auth";
import { buildAuthorizationDossier } from "@/lib/authorization/dossier";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const { userId } = await context.params;

  const member = await db.user.findFirst({
    where: {
      id: userId,
      companyId,
      role: { in: ["REP", "COMPANY_ADMIN"] },
    },
    select: { id: true },
  });

  if (!member) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const dossier = await buildAuthorizationDossier(userId);
  if (!dossier) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(dossier);
}
