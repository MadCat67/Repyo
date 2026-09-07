import { db } from "@/lib/db";
import type { HealthcareSiteStatus, Prisma } from "@prisma/client";
import {
  normalizeSiteSlug,
  normalizeZip,
  type HealthcareSiteInput,
} from "./normalize";

export async function findOrCreateHealthcareSite(
  input: HealthcareSiteInput,
  options?: {
    createdById?: string;
    status?: HealthcareSiteStatus;
  }
) {
  const slug = normalizeSiteSlug(input.name, input.city, input.state);
  const zipCode = normalizeZip(input.zipCode);

  const existing = await db.healthcareSite.findUnique({ where: { slug } });
  if (existing) return existing;

  const similar = await db.healthcareSite.findFirst({
    where: {
      zipCode,
      name: { equals: input.name.trim(), mode: "insensitive" },
      status: { not: "MERGED" },
    },
  });
  if (similar) return similar;

  return db.healthcareSite.create({
    data: {
      slug,
      name: input.name.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase().slice(0, 2),
      zipCode,
      phone: input.phone?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      siteType: input.siteType ?? "HOSPITAL",
      status: options?.status ?? "PENDING_REVIEW",
      createdById: options?.createdById ?? null,
      verifiedAt: options?.status === "ACTIVE" ? new Date() : null,
    },
  });
}

export async function searchHealthcareSites(params: {
  q?: string;
  state?: string;
  organizationId?: string;
  limit?: number;
}) {
  const limit = Math.min(params.limit ?? 20, 50);
  const q = params.q?.trim();

  let siteIds: string[] | undefined;
  if (params.organizationId) {
    const links = await db.organizationSiteLink.findMany({
      where: { organizationId: params.organizationId },
      select: { siteId: true },
    });
    siteIds = links.map((l) => l.siteId);
    if (siteIds.length === 0) {
      return [];
    }
  }

  const where: Prisma.HealthcareSiteWhereInput = {
    status: { in: ["ACTIVE", "PENDING_REVIEW"] },
    ...(siteIds ? { id: { in: siteIds } } : {}),
    ...(params.state
      ? { state: params.state.trim().toUpperCase().slice(0, 2) }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { zipCode: { startsWith: q.replace(/\D/g, "").slice(0, 5) } },
          ],
        }
      : {}),
  };

  return db.healthcareSite.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      phone: true,
      lat: true,
      lng: true,
      siteType: true,
      status: true,
    },
  });
}

export async function linkSiteToOrganization(
  organizationId: string,
  siteId: string,
  isPrimary = false
) {
  return db.organizationSiteLink.upsert({
    where: {
      organizationId_siteId: { organizationId, siteId },
    },
    create: { organizationId, siteId, isPrimary },
    update: { isPrimary },
  });
}

export async function setProviderSites(
  userId: string,
  siteIds: string[],
  options?: {
    organizationId?: string | null;
    primarySiteId?: string | null;
    jobTitle?: string | null;
    department?: string | null;
  }
) {
  const uniqueIds = [...new Set(siteIds.filter(Boolean))];
  const primaryId =
    options?.primarySiteId && uniqueIds.includes(options.primarySiteId)
      ? options.primarySiteId
      : uniqueIds[0] ?? null;

  await db.$transaction([
    db.providerSiteMembership.deleteMany({ where: { userId } }),
    ...uniqueIds.map((siteId) =>
      db.providerSiteMembership.create({
        data: {
          userId,
          siteId,
          organizationId: options?.organizationId ?? null,
          isPrimary: siteId === primaryId,
          jobTitle: options?.jobTitle ?? null,
          department: options?.department ?? null,
        },
      })
    ),
  ]);

  if (primaryId) {
    const site = await db.healthcareSite.findUnique({ where: { id: primaryId } });
    if (site) {
      await db.providerProfile.update({
        where: { userId },
        data: {
          facilityName: site.name,
          facilityAddress: `${site.address}, ${site.city}, ${site.state} ${site.zipCode}`,
          zipCode: site.zipCode,
        },
      });
    }
  }

  return db.providerSiteMembership.findMany({
    where: { userId },
    include: { site: true },
  });
}

export async function setRepSiteCoverage(repUserId: string, siteIds: string[]) {
  const uniqueIds = [...new Set(siteIds.filter(Boolean))];

  await db.$transaction([
    db.repSiteCoverage.deleteMany({ where: { repUserId } }),
    ...uniqueIds.map((siteId) =>
      db.repSiteCoverage.create({
        data: { repUserId, siteId },
      })
    ),
  ]);

  return db.repSiteCoverage.findMany({
    where: { repUserId },
    include: { site: true },
  });
}

export async function importHealthcareSitesFromJson(
  sites: HealthcareSiteInput[],
  options?: { defaultStatus?: HealthcareSiteStatus }
) {
  const imported = [];
  for (const site of sites) {
    const record = await findOrCreateHealthcareSite(site, {
      status: options?.defaultStatus ?? "ACTIVE",
    });
    imported.push(record);
  }
  return imported;
}
