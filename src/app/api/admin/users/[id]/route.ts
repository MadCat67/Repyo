import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateUserSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  if (id === session.user.id && parsed.data.role) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: { select: { name: true } },
    },
  });

  return NextResponse.json(user);
}
