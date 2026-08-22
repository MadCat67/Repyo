import { db } from "./db";
import { parseZipCode, zipInRange } from "./zip-utils";

export async function findMatchingAdmin(
  companyId: string,
  zipCode: string
): Promise<{ id: string; name: string; delegatedRepId: string | null; delegationActive: boolean } | null> {
  const normalized = zipCode.trim();
  if (!parseZipCode(normalized)) return null;

  const admins = await db.user.findMany({
    where: {
      role: "COMPANY_ADMIN",
      companyId,
      zipCodeStart: { not: null },
      zipCodeEnd: { not: null },
    },
    select: {
      id: true,
      name: true,
      zipCodeStart: true,
      zipCodeEnd: true,
      delegatedRepId: true,
      delegationActive: true,
    },
  });

  const match = admins.find((admin) =>
    zipInRange(normalized, admin.zipCodeStart, admin.zipCodeEnd)
  );

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    delegatedRepId: match.delegatedRepId,
    delegationActive: match.delegationActive,
  };
}

export async function getDelegatedAdminIdsForRep(repId: string): Promise<string[]> {
  const admins = await db.user.findMany({
    where: {
      role: "COMPANY_ADMIN",
      delegationActive: true,
      delegatedRepId: repId,
    },
    select: { id: true },
  });

  return admins.map((a) => a.id);
}

export async function canActAsAdminForRequest(
  userId: string,
  role: string,
  assignedAdminId: string | null
): Promise<boolean> {
  if (role === "COMPANY_ADMIN" && assignedAdminId === userId) return true;
  if (role !== "REP" || !assignedAdminId) return false;

  const admin = await db.user.findFirst({
    where: {
      id: assignedAdminId,
      role: "COMPANY_ADMIN",
      delegationActive: true,
      delegatedRepId: userId,
    },
  });

  return !!admin;
}
