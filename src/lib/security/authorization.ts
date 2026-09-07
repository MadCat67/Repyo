import type { Role, RequestStatus, UserAccountState } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  companyId: string | null;
  accountState?: UserAccountState;
  adminPermissions?: string[];
};

export const ORG_ADMIN_PERMISSIONS = {
  MANAGE_ORG_USERS: "MANAGE_ORG_USERS",
  APPROVE_USERS: "APPROVE_USERS",
  MANAGE_ORG_SETTINGS: "MANAGE_ORG_SETTINGS",
} as const;

export const ADMIN_PERMISSIONS = {
  MANAGE_REPS: "MANAGE_REPS",
  MANAGE_REQUESTS: "MANAGE_REQUESTS",
  VIEW_CALENDAR: "VIEW_CALENDAR",
  MANAGE_TEAMS: "MANAGE_TEAMS",
  VIEW_TEAM_CALENDAR: "VIEW_TEAM_CALENDAR",
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

/** PHI visible to reps after request is accepted, or after acknowledgment while still pending. */
export function canViewRequestPhi(
  user: SessionUser,
  request: {
    providerId: string | null;
    assignedRepId: string | null;
    assignedAdminId: string | null;
    initiatedByRepId: string | null;
    status: RequestStatus;
    acknowledgedAt?: Date | string | null;
  },
  options?: { isDelegatedAdmin?: boolean }
): boolean {
  if (request.status === "CANCELLED" || request.status === "DECLINED") {
    if (user.role === "PROVIDER" && request.providerId === user.id) return true;
    return false;
  }

  if (request.status === "REQUESTING") {
    if (user.role === "PROVIDER" && request.providerId === user.id) return true;
    if (
      user.role === "REP" &&
      request.assignedRepId === user.id &&
      request.acknowledgedAt
    ) {
      return true;
    }
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

  if (
    user.role === "REP" &&
    request.assignedRepId === user.id &&
    request.status === "REQUESTING" &&
    (request as { acknowledgedAt?: Date | null }).acknowledgedAt
  ) {
    return true;
  }

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
