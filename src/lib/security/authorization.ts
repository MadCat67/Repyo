import type { Role, RequestStatus, UserAccountState } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  companyId: string | null;
  accountState?: UserAccountState;
  adminPermissions?: string[];
};

export const ADMIN_PERMISSIONS = {
  MANAGE_REPS: "MANAGE_REPS",
  MANAGE_REQUESTS: "MANAGE_REQUESTS",
  VIEW_CALENDAR: "VIEW_CALENDAR",
  MANAGE_INTEGRATIONS: "MANAGE_INTEGRATIONS",
  MANAGE_TERRITORY: "MANAGE_TERRITORY",
} as const;

export const SECURITY_PERMISSIONS = {
  SECURITY_KILL_SWITCH: "SECURITY_KILL_SWITCH",
  REVOKE_SESSIONS: "REVOKE_SESSIONS",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
} as const;

export function isAccountActive(state: UserAccountState | undefined): boolean {
  return !state || state === "REGISTERED" || state === "VERIFIED";
}

export function hasAdminPermission(
  user: SessionUser,
  permission: string
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role !== "COMPANY_ADMIN") return false;
  return (user.adminPermissions ?? []).includes(permission);
}

export function hasSecurityPermission(
  user: SessionUser,
  permission: string
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  return (user.adminPermissions ?? []).includes(permission);
}

/** PHI visible to reps only after request is accepted and rep is properly matched. */
export function canViewRequestPhi(
  user: SessionUser,
  request: {
    providerId: string | null;
    assignedRepId: string | null;
    assignedAdminId: string | null;
    initiatedByRepId: string | null;
    status: RequestStatus;
  },
  options?: { isDelegatedAdmin?: boolean }
): boolean {
  if (request.status === "REQUESTING" || request.status === "CANCELLED") {
    if (user.role === "PROVIDER" && request.providerId === user.id) return true;
    return false;
  }

  if (user.role === "PROVIDER" && request.providerId === user.id) return true;

  if (user.role === "REP") {
    if (request.assignedRepId === user.id) return true;
    if (request.initiatedByRepId === user.id) return true;
    if (options?.isDelegatedAdmin && request.assignedAdminId) return false;
  }

  if (user.role === "COMPANY_ADMIN") {
    return false;
  }

  return false;
}

export function canViewDeviceIdentifiers(
  user: SessionUser,
  request: {
    providerId: string | null;
    assignedRepId: string | null;
    assignedAdminId: string | null;
    initiatedByRepId: string | null;
    companyId: string;
    status: RequestStatus;
  },
  options?: { isDelegatedAdmin?: boolean }
): boolean {
  if (canViewRequestPhi(user, request, options)) return true;

  if (user.role === "COMPANY_ADMIN" && user.companyId === request.companyId) {
    return ["ACCEPTED", "EN_ROUTE", "ARRIVED", "COMPLETED"].includes(
      request.status
    );
  }

  if (options?.isDelegatedAdmin) {
    return ["ACCEPTED", "EN_ROUTE", "ARRIVED", "COMPLETED"].includes(
      request.status
    );
  }

  return false;
}

export function canAccessRequestRecord(
  user: SessionUser,
  request: {
    providerId: string | null;
    assignedRepId: string | null;
    assignedAdminId: string | null;
    initiatedByRepId: string | null;
    companyId: string;
  },
  options?: { delegatedAdminIds?: string[] }
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "PROVIDER" && request.providerId === user.id) return true;
  if (user.role === "REP") {
    if (request.assignedRepId === user.id) return true;
    if (request.initiatedByRepId === user.id) return true;
    if (
      request.assignedAdminId &&
      options?.delegatedAdminIds?.includes(request.assignedAdminId)
    ) {
      return true;
    }
  }
  if (user.role === "COMPANY_ADMIN") {
    if (user.companyId !== request.companyId) return false;
    if (request.assignedAdminId === user.id) return true;
    return hasAdminPermission(user, ADMIN_PERMISSIONS.MANAGE_REQUESTS);
  }
  return false;
}
