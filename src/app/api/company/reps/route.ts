import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRepSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company assigned" }, { status: 400 });
  }

  const reps = await db.user.findMany({
    where: { companyId, role: "REP" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      repProfile: {
        include: { territories: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(reps);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company assigned" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = createRepSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const email = data.email.trim().toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true, products: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const invalidProducts = data.products.filter((p) => !company.products.includes(p));
    if (invalidProducts.length > 0) {
      return NextResponse.json(
        { error: "One or more products are not offered by your company" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const rep = await db.user.create({
      data: {
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        passwordHash,
        role: "REP",
        companyId,
        repProfile: {
          create: {
            status: data.status,
            credentialStatus: data.credentialStatus,
            symplrMerged: data.credentialStatus === "ACTIVE",
            products: data.products,
            companies: [company.name],
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        repProfile: {
          include: { territories: true },
        },
      },
    });

    return NextResponse.json(rep, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/reps error:", error);
    return NextResponse.json({ error: "Failed to create rep" }, { status: 500 });
  }
}
