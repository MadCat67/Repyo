import {
  CredentialStatus,
  RepStatus,
  RequestStatus,
  type RepProfile,
  type Territory,
  type User,
} from "@prisma/client";
import { db } from "./db";
import { distanceMiles, estimateEtaMinutes } from "./utils";

export interface RoutingCriteria {
  companyId: string;
  facilityName: string;
  facilityLat?: number | null;
  facilityLng?: number | null;
  facilityState?: string | null;
  facilityZip?: string | null;
  product?: string | null;
  preferredRepId?: string | null;
}

export interface EligibleRep {
  userId: string;
  name: string;
  phone: string | null;
  distanceMiles: number;
  etaMinutes: number;
  lat: number | null;
  lng: number | null;
}

type RepWithProfile = User & {
  repProfile: (RepProfile & { territories: Territory[] }) | null;
};

function repCoversTerritory(
  rep: RepWithProfile,
  criteria: RoutingCriteria
): boolean {
  const territories = rep.repProfile?.territories ?? [];
  if (territories.length === 0) return true;

  const hasLocation =
    criteria.facilityState ||
    criteria.facilityZip ||
    criteria.facilityLat != null;

  if (!hasLocation) return true;

  return territories.some((t) => {
    if (t.facilityId) return false;
    if (criteria.facilityState && t.state === criteria.facilityState)
      return true;
    if (criteria.facilityZip && t.zipCode === criteria.facilityZip) return true;
    return false;
  });
}

function repHasProduct(rep: RepWithProfile, product?: string | null): boolean {
  if (!product) return true;
  const products = rep.repProfile?.products ?? [];
  return products.length === 0 || products.includes(product);
}

export async function findEligibleReps(
  criteria: RoutingCriteria
): Promise<EligibleRep[]> {
  const reps = await db.user.findMany({
    where: {
      role: "REP",
      companyId: criteria.companyId,
      repProfile: {
        status: RepStatus.AVAILABLE,
        credentialStatus: CredentialStatus.ACTIVE,
      },
    },
    include: {
      repProfile: { include: { territories: true } },
    },
  });

  const eligible: EligibleRep[] = [];

  for (const rep of reps) {
    if (!rep.repProfile) continue;
    if (!repCoversTerritory(rep, criteria)) continue;
    if (!repHasProduct(rep, criteria.product)) continue;

    const { lat, lng } = rep.repProfile;
    let dist = Infinity;

    if (
      lat != null &&
      lng != null &&
      criteria.facilityLat != null &&
      criteria.facilityLng != null
    ) {
      dist = distanceMiles(
        lat,
        lng,
        criteria.facilityLat,
        criteria.facilityLng
      );
      if (dist > rep.repProfile.travelRadiusMiles) continue;
    }

    eligible.push({
      userId: rep.id,
      name: rep.name,
      phone: rep.phone,
      distanceMiles: dist === Infinity ? 0 : dist,
      etaMinutes: dist === Infinity ? 0 : estimateEtaMinutes(dist),
      lat,
      lng,
    });
  }

  if (criteria.preferredRepId) {
    const preferred = eligible.find((r) => r.userId === criteria.preferredRepId);
    if (preferred) {
      return [preferred, ...eligible.filter((r) => r.userId !== criteria.preferredRepId)];
    }
  }

  return eligible.sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export async function assignRepToRequest(
  requestId: string,
  criteria: RoutingCriteria
): Promise<{ assigned: boolean; repId?: string; repName?: string }> {
  const eligible = await findEligibleReps(criteria);

  if (eligible.length === 0) {
    return { assigned: false };
  }

  const bestRep = eligible[0];

  await db.$transaction([
    db.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedRepId: bestRep.userId,
        status: RequestStatus.ASSIGNED,
        etaMinutes: bestRep.etaMinutes,
        repLat: bestRep.lat,
        repLng: bestRep.lng,
      },
    }),
    db.requestStatusLog.create({
      data: {
        requestId,
        status: RequestStatus.ASSIGNED,
        note: `Assigned to ${bestRep.name}`,
      },
    }),
    db.notification.create({
      data: {
        userId: bestRep.userId,
        title: "New Rep Request",
        body: `You have a new request at ${criteria.facilityName}`,
        type: "REQUEST_ASSIGNED",
        data: { requestId },
      },
    }),
  ]);

  realtimeBus.emit("request:updated", { requestId });
  realtimeBus.emit(`user:${bestRep.userId}`, {
    type: "REQUEST_ASSIGNED",
    requestId,
  });

  return {
    assigned: true,
    repId: bestRep.userId,
    repName: bestRep.name,
  };
}

/** In-process event bus for SSE. Production should use Redis pub/sub. */
type RealtimeListener = (data: unknown) => void;

class RealtimeBus {
  private channels = new Map<string, Set<RealtimeListener>>();

  subscribe(channel: string, listener: RealtimeListener): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(listener);
    return () => this.channels.get(channel)?.delete(listener);
  }

  emit(channel: string, data: unknown): void {
    this.channels.get(channel)?.forEach((listener) => listener(data));
  }
}

export const realtimeBus = new RealtimeBus();
