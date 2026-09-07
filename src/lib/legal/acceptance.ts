import { db } from "@/lib/db";
import type { Prisma, Role } from "@prisma/client";
import { headers } from "next/headers";

export type AcceptanceContext = {
  userId: string;
  legalName: string;
  role: Role;
  organizationId?: string | null;
  organizationName?: string | null;
  facilityName?: string | null;
  signatureText?: string;
};

export async function recordAgreementAcceptances(
  slugs: string[],
  context: AcceptanceContext
) {
  const documents = await db.legalDocument.findMany({
    where: { slug: { in: slugs }, active: true },
  });

  if (documents.length !== slugs.length) {
    const found = new Set(documents.map((d) => d.slug));
    const missing = slugs.filter((s) => !found.has(s));
    throw new Error(`Missing legal documents: ${missing.join(", ")}`);
  }

  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const userAgent = headerStore.get("user-agent");

  const signature =
    context.signatureText ??
    `${context.legalName} — electronic acceptance ${new Date().toISOString()}`;

  await db.agreementAcceptance.createMany({
    data: documents.map((doc) => ({
      userId: context.userId,
      documentId: doc.id,
      documentSlug: doc.slug,
      documentVersion: doc.version,
      documentTitle: doc.title,
      legalName: context.legalName,
      role: context.role,
      organizationId: context.organizationId ?? null,
      organizationName: context.organizationName ?? null,
      facilityName: context.facilityName ?? null,
      signatureText: signature,
      ipAddress,
      userAgent,
      metadata: {
        acceptanceMethod: "signup_checkbox",
        platform: "web",
      } as Prisma.InputJsonValue,
    })),
  });
}

export async function userHasRequiredAgreements(
  userId: string,
  role: Role
): Promise<boolean> {
  const { requiredSlugsForRole } = await import("@/lib/legal/documents");
  const required = requiredSlugsForRole(role);
  if (required.length === 0) return true;

  const acceptances = await db.agreementAcceptance.findMany({
    where: {
      userId,
      documentSlug: { in: [...required] },
    },
    select: { documentSlug: true },
  });

  const accepted = new Set(acceptances.map((a) => a.documentSlug));
  return required.every((slug) => accepted.has(slug));
}
