"use server";

import { signIn } from "@/lib/auth";
import { canAccessRoute, getDefaultRoute } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { signupSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    companyId: formData.get("companyId") || undefined,
    facilityName: formData.get("facilityName") || undefined,
    facilityAddress: formData.get("facilityAddress") || undefined,
    department: formData.get("department") || undefined,
    zipCode: formData.get("zipCode") || undefined,
    facilityContactName: formData.get("facilityContactName") || undefined,
    facilityContactPhone: formData.get("facilityContactPhone") || undefined,
    requesterPhone: formData.get("requesterPhone") || undefined,
    requesterFax: formData.get("requesterFax") || undefined,
    zipCodeStart: formData.get("zipCodeStart") || undefined,
    zipCodeEnd: formData.get("zipCodeEnd") || undefined,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Validation failed";
    return { error: firstIssue };
  }

  const {
    name,
    email,
    password,
    role,
    companyId,
    facilityName,
    facilityAddress,
    department,
    zipCode,
    facilityContactName,
    facilityContactPhone,
    requesterPhone,
    requesterFax,
    zipCodeStart,
    zipCodeEnd,
  } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return { error: "An account with this email already exists. Try signing in." };
  }

  if (companyId) {
    const company = await db.company.findFirst({
      where: { id: companyId, active: true },
    });
    if (!company) {
      return { error: "Selected device company not found" };
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      companyId: companyId ?? null,
      ...(role === "COMPANY_ADMIN" && {
        zipCodeStart: zipCodeStart?.trim().slice(0, 5) ?? null,
        zipCodeEnd: zipCodeEnd?.trim().slice(0, 5) ?? null,
      }),
      ...(role === "PROVIDER" && {
        phone: requesterPhone?.trim() || null,
        providerInfo: {
          create: {
            facilityName: facilityName?.trim() || null,
            facilityAddress: facilityAddress?.trim() || null,
            facilityContactName: facilityContactName?.trim() || null,
            facilityContactPhone: facilityContactPhone?.trim() || null,
            department: department?.trim() || null,
            zipCode: zipCode?.trim().slice(0, 5) ?? null,
            requesterPhone: requesterPhone?.trim() || null,
            requesterFax: requesterFax?.trim() || null,
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
  });

  try {
    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirectTo: getDefaultRoute(role),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return {
        error:
          "Account created, but automatic sign-in failed. Please sign in with your email and password.",
      };
    }
    throw error;
  }
}

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : getDefaultRoute(user.role);

  const redirectTo = canAccessRoute(user.role, safeCallback)
    ? safeCallback
    : getDefaultRoute(user.role);

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }

  return null;
}
