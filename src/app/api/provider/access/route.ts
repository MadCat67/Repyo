import { auth } from "@/lib/auth";
import { getProviderAccess } from "@/lib/provider-access";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getProviderAccess(session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Provider profile not found" }, { status: 404 });
  }

  return NextResponse.json(access);
}
