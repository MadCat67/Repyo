import { decryptPHI, decryptDate } from "@/lib/encryption";
import type { SessionUser } from "@/lib/security/authorization";
import {
  canViewDeviceIdentifiers,
  canViewRequestPhi,
} from "@/lib/security/authorization";
import type { RequestStatus, Role } from "@prisma/client";

type RawRequest = {
  id: string;
  providerId: string | null;
  assignedRepId: string | null;
  assignedAdminId: string | null;
  initiatedByRepId: string | null;
  companyId: string;
  status: RequestStatus;
  facilityName: string;
  facilityAddr: string;
  facilityZipCode: string | null;
  department: string | null;
  procedureType: string | null;
  requestType: string;
  product: string | null;
  urgency: string;
  scheduledAt: Date;
  notes: string | null;
  deviceManufacturer: string | null;
  patientNameEnc: string | null;
  patientDOBEnc: string | null;
  patientRoomEnc: string | null;
  deviceNameEnc: string | null;
  deviceSerialEnc: string | null;
  crmLookupStatus: string | null;
  recordLifecycle?: string;
  [key: string]: unknown;
};

export function sanitizeRequestForUser(
  request: RawRequest,
  user: SessionUser,
  options?: { isDelegatedAdmin?: boolean }
) {
  const {
    patientNameEnc,
    patientDOBEnc,
    patientRoomEnc,
    deviceNameEnc,
    deviceSerialEnc,
    ...base
  } = request;

  const phiAllowed = canViewRequestPhi(user, request, options);
  const deviceAllowed = canViewDeviceIdentifiers(user, request, options);
  const isPreAcceptance =
    request.status === "REQUESTING" && user.role !== "PROVIDER";

  const sanitized = {
    ...base,
    patientNameEnc: undefined,
    patientDOBEnc: undefined,
    patientRoomEnc: undefined,
    deviceNameEnc: undefined,
    deviceSerialEnc: undefined,
    phiRestricted: !phiAllowed,
    identifiersHidden: isPreAcceptance && user.role !== "PROVIDER",
  };

  if (phiAllowed) {
    Object.assign(sanitized, {
      patientName: patientNameEnc ? decryptPHI(patientNameEnc) : null,
      patientDOB: patientDOBEnc
        ? decryptDate(patientDOBEnc).toISOString()
        : null,
      patientRoom: patientRoomEnc ? decryptPHI(patientRoomEnc) : null,
    });
  }

  if (deviceAllowed) {
    Object.assign(sanitized, {
      deviceName: deviceNameEnc ? decryptPHI(deviceNameEnc) : null,
      deviceSerial: deviceSerialEnc ? decryptPHI(deviceSerialEnc) : null,
    });
  } else if (isPreAcceptance) {
    Object.assign(sanitized, {
      deviceManufacturer: undefined,
      crmLookupStatus: undefined,
    });
  }

  if (isPreAcceptance && user.role === "REP") {
    return {
      ...sanitized,
      notes: sanitized.notes ? "[Details available after acceptance]" : null,
      requesterName: undefined,
      requesterPhone: undefined,
      requesterEmail: undefined,
      requesterFax: undefined,
      physicianName: undefined,
    };
  }

  return sanitized;
}

export async function getProviderOrgContext(userId: string) {
  const { db } = await import("@/lib/db");
  const profile = await db.providerProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  return profile?.organizationId ?? null;
}

export function toSessionUser(user: {
  id: string;
  role: Role;
  companyId: string | null;
  accountState?: SessionUser["accountState"];
  adminPermissions?: string[];
}): SessionUser {
  return {
    id: user.id,
    role: user.role,
    companyId: user.companyId,
    accountState: user.accountState,
    adminPermissions: user.adminPermissions,
  };
}
