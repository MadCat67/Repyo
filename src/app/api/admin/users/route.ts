import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateUserSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
