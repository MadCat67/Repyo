import { db } from "@/lib/db";
import { getDefaultRoute } from "@/lib/auth-utils";
import { signupSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, role, companyId, facilityName, department } =
    parsed.data;

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  if (companyId) {
    const company = await db.company.findFirst({
      where: { id: companyId, active: true },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Selected device company not found" },
        { status: 400 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      companyId: companyId ?? null,
      ...(role === "PROVIDER" && {
        providerInfo: {
          create: {
            facilityName: facilityName?.trim() || null,
            department: department?.trim() || null,
          },
        },
      }),
      ...(role === "REP" && {
        repProfile: {
          create: {
            status: "OFF_DUTY",
            credentialStatus: "PENDING",
            products: [],
            companies: companyId
              ? [
                  (
                    await db.company.findUnique({
                      where: { id: companyId },
                      select: { name: true },
                    })
                  )?.name ?? "",
                ].filter(Boolean)
              : [],
          },
        },
      }),
    },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json(
    {
      user,
      redirectTo: getDefaultRoute(user.role),
    },
    { status: 201 }
  );
}
