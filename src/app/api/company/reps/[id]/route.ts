import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateRepCredentialSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateRepCredentialSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const rep = await db.user.findFirst({
    where: { id, role: "REP", companyId: session.user.companyId ?? undefined },
  });

  if (!rep) {
    return NextResponse.json({ error: "Rep not found" }, { status: 404 });
  }

  const updated = await db.repProfile.update({
    where: { userId: id },
    data: { credentialStatus: parsed.data.credentialStatus },
  });

  return NextResponse.json(updated);
}
