import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateCompanySchema } from "@/lib/validations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateCompanySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const company = await db.company.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(company);
}
