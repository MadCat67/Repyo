import { PrismaClient, RequestStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptPHI, encryptDate } from "../src/lib/encryption";

const db = new PrismaClient();

const DEMO_PASSWORD = "demo123";
const DEMO_EMAILS = [
  "provider@demo.com",
  "provider2@demo.com",
  "rep@demo.com",
  "rep2@demo.com",
  "rep3@demo.com",
  "admin@demo.com",
  "admin2@demo.com",
  "super@demo.com",
];

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

function daysFromNow(d: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function clearDemoData() {
  const demoUsers = await db.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true },
  });
  const ids = demoUsers.map((u) => u.id);
  if (ids.length === 0) return;

  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.favoriteRep.deleteMany({
    where: { OR: [{ providerId: { in: ids } }, { repId: { in: ids } }] },
  });

  const demoRequests = await db.serviceRequest.findMany({
    where: {
      OR: [{ providerId: { in: ids } }, { assignedRepId: { in: ids } }],
    },
    select: { id: true },
  });
  const requestIds = demoRequests.map((r) => r.id);

  if (requestIds.length > 0) {
    await db.requestStatusLog.deleteMany({ where: { requestId: { in: requestIds } } });
    await db.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
  }
}

async function logStatus(
  requestId: string,
  status: RequestStatus,
  note: string,
  offsetMinutes = 0
) {
  await db.requestStatusLog.create({
    data: {
      requestId,
      status,
      note,
      createdAt: new Date(Date.now() - offsetMinutes * 60 * 1000),
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await clearDemoData();

  const medtronic = await db.company.upsert({
    where: { slug: "medtronic" },
    update: {
      products: ["PPM", "ICD", "CRT-D", "CRT-P", "Loop", "Leadless PPM"],
      active: true,
    },
    create: {
      name: "Medtronic",
      slug: "medtronic",
      products: ["PPM", "ICD", "CRT-D", "CRT-P", "Loop", "Leadless PPM"],
    },
  });

  const boston = await db.company.upsert({
    where: { slug: "boston-scientific" },
    update: {
      products: ["Watchman", "ICD", "CRT-D", "Ablation"],
      active: true,
    },
    create: {
      name: "Boston Scientific",
      slug: "boston-scientific",
      products: ["Watchman", "ICD", "CRT-D", "Ablation"],
    },
  });

  const valleyFacility =
    (await db.facility.findFirst({ where: { name: "Valley Heart Center" } })) ??
    (await db.facility.create({
      data: {
        name: "Valley Heart Center",
        address: "1200 Medical Blvd, Phoenix, AZ 85004",
        phone: "(602) 555-0100",
        lat: 33.4484,
        lng: -112.074,
        state: "AZ",
        county: "Maricopa",
        zipCode: "85004",
        companyId: medtronic.id,
      },
    }));

  const desertFacility =
    (await db.facility.findFirst({ where: { name: "Desert Regional Medical" } })) ??
    (await db.facility.create({
      data: {
        name: "Desert Regional Medical",
        address: "45000 Monterey Ave, Palm Desert, CA 92260",
        phone: "(760) 555-0200",
        lat: 33.7222,
        lng: -116.3745,
        state: "CA",
        county: "Riverside",
        zipCode: "92260",
        companyId: boston.id,
      },
    }));

  const provider = await db.user.upsert({
    where: { email: "provider@demo.com" },
    update: { passwordHash, name: "Dr. Sarah Chen", phone: "(602) 555-0101" },
    create: {
      email: "provider@demo.com",
      passwordHash,
      name: "Dr. Sarah Chen",
      phone: "(602) 555-0101",
      role: "PROVIDER",
      providerInfo: {
        create: {
          facilityName: "Valley Heart Center",
          facilityAddress: "1200 Medical Blvd, Phoenix, AZ 85004",
          facilityPhone: "(602) 555-0100",
          department: "EP Lab",
          defaultPhysician: "Dr. Sarah Chen",
        },
      },
    },
    include: { providerInfo: true },
  });

  if (!provider.providerInfo) {
    await db.providerProfile.create({
      data: {
        userId: provider.id,
        facilityName: "Valley Heart Center",
        facilityAddress: "1200 Medical Blvd, Phoenix, AZ 85004",
        facilityPhone: "(602) 555-0100",
        department: "EP Lab",
        defaultPhysician: "Dr. Sarah Chen",
      },
    });
  }

  const provider2 = await db.user.upsert({
    where: { email: "provider2@demo.com" },
    update: { passwordHash, name: "Dr. James Park" },
    create: {
      email: "provider2@demo.com",
      passwordHash,
      name: "Dr. James Park",
      phone: "(760) 555-0102",
      role: "PROVIDER",
      providerInfo: {
        create: {
          facilityName: "Desert Regional Medical",
          facilityAddress: "45000 Monterey Ave, Palm Desert, CA 92260",
          department: "Cath Lab",
          defaultPhysician: "Dr. James Park",
        },
      },
    },
  });

  async function upsertRep(
    email: string,
    name: string,
    phone: string,
    companyId: string,
    companyName: string,
    profile: {
      status: "AVAILABLE" | "BUSY" | "OFF_DUTY" | "VACATION";
      lat: number;
      lng: number;
      products: string[];
      credentialStatus: "ACTIVE" | "PENDING";
      onCallEnabled: boolean;
      territory: { state: string; county: string; zipCode: string };
    }
  ) {
    const user = await db.user.upsert({
      where: { email },
      update: { passwordHash, name, phone, companyId },
      create: {
        email,
        passwordHash,
        name,
        phone,
        role: "REP",
        companyId,
      },
    });

    await db.repProfile.upsert({
      where: { userId: user.id },
      update: {
        status: profile.status,
        lat: profile.lat,
        lng: profile.lng,
        travelRadiusMiles: 75,
        credentialStatus: profile.credentialStatus,
        symplrMerged: profile.credentialStatus === "ACTIVE",
        products: profile.products,
        companies: [companyName],
        onCallEnabled: profile.onCallEnabled,
      },
      create: {
        userId: user.id,
        status: profile.status,
        lat: profile.lat,
        lng: profile.lng,
        travelRadiusMiles: 75,
        credentialStatus: profile.credentialStatus,
        symplrMerged: profile.credentialStatus === "ACTIVE",
        products: profile.products,
        companies: [companyName],
        onCallEnabled: profile.onCallEnabled,
      },
    });

    await db.territory.deleteMany({ where: { repProfileId: user.id } });
    await db.territory.create({
      data: {
        repProfileId: user.id,
        state: profile.territory.state,
        county: profile.territory.county,
        zipCode: profile.territory.zipCode,
      },
    });

    return user;
  }

  const repMike = await upsertRep(
    "rep@demo.com",
    "Mike Rodriguez",
    "(602) 555-0200",
    medtronic.id,
    "Medtronic",
    {
      status: "AVAILABLE",
      lat: 33.4152,
      lng: -111.8315,
      products: ["PPM", "ICD", "CRT-D"],
      credentialStatus: "ACTIVE",
      onCallEnabled: true,
      territory: { state: "AZ", county: "Maricopa", zipCode: "85004" },
    }
  );

  const repLisa = await upsertRep(
    "rep2@demo.com",
    "Lisa Wong",
    "(602) 555-0201",
    medtronic.id,
    "Medtronic",
    {
      status: "BUSY",
      lat: 33.5092,
      lng: -111.989,
      products: ["Loop", "Leadless PPM", "CRT-P"],
      credentialStatus: "ACTIVE",
      onCallEnabled: false,
      territory: { state: "AZ", county: "Maricopa", zipCode: "85004" },
    }
  );

  const repTom = await upsertRep(
    "rep3@demo.com",
    "Tom Hayes",
    "(760) 555-0202",
    boston.id,
    "Boston Scientific",
    {
      status: "AVAILABLE",
      lat: 33.68,
      lng: -116.173,
      products: ["Watchman", "Ablation", "ICD"],
      credentialStatus: "ACTIVE",
      onCallEnabled: true,
      territory: { state: "CA", county: "Riverside", zipCode: "92260" },
    }
  );

  await db.user.upsert({
    where: { email: "admin@demo.com" },
    update: { passwordHash, companyId: medtronic.id },
    create: {
      email: "admin@demo.com",
      passwordHash,
      name: "Medtronic Admin",
      role: "COMPANY_ADMIN",
      companyId: medtronic.id,
    },
  });

  await db.user.upsert({
    where: { email: "admin2@demo.com" },
    update: { passwordHash, companyId: boston.id },
    create: {
      email: "admin2@demo.com",
      passwordHash,
      name: "Boston Admin",
      role: "COMPANY_ADMIN",
      companyId: boston.id,
    },
  });

  await db.user.upsert({
    where: { email: "super@demo.com" },
    update: { passwordHash },
    create: {
      email: "super@demo.com",
      passwordHash,
      name: "Platform Admin",
      role: "SUPER_ADMIN",
    },
  });

  await db.favoriteRep.upsert({
    where: { providerId_repId: { providerId: provider.id, repId: repMike.id } },
    create: { providerId: provider.id, repId: repMike.id },
    update: {},
  });

  async function createRequest(
    data: {
      providerId: string;
      companyId: string;
      assignedRepId?: string;
      facilityName: string;
      facilityAddr: string;
      facilityLat?: number;
      facilityLng?: number;
      department: string;
      physicianName: string;
      patientName: string;
      patientDOB: Date;
      procedureType: string;
      product?: string;
      urgency: "EMERGENCY" | "SAME_DAY" | "SCHEDULED";
      scheduledAt: Date;
      status: RequestStatus;
      notes?: string;
      etaMinutes?: number;
      repLat?: number;
      repLng?: number;
    },
    statusHistory: { status: RequestStatus; note: string; minutesAgo: number }[]
  ) {
    const req = await db.serviceRequest.create({
      data: {
        providerId: data.providerId,
        companyId: data.companyId,
        assignedRepId: data.assignedRepId,
        facilityName: data.facilityName,
        facilityAddr: data.facilityAddr,
        facilityPhone: "(602) 555-0100",
        facilityLat: data.facilityLat,
        facilityLng: data.facilityLng,
        department: data.department,
        physicianName: data.physicianName,
        patientNameEnc: encryptPHI(data.patientName),
        patientDOBEnc: encryptDate(data.patientDOB),
        procedureType: data.procedureType,
        product: data.product,
        urgency: data.urgency,
        scheduledAt: data.scheduledAt,
        status: data.status,
        notes: data.notes,
        etaMinutes: data.etaMinutes,
        repLat: data.repLat,
        repLng: data.repLng,
      },
    });

    for (const entry of statusHistory) {
      await logStatus(req.id, entry.status, entry.note, entry.minutesAgo);
    }

    return req;
  }

  // 1. Emergency — assigned, waiting for rep to accept
  const emergency = await createRequest(
    {
      providerId: provider.id,
      companyId: medtronic.id,
      assignedRepId: repMike.id,
      facilityName: valleyFacility.name,
      facilityAddr: valleyFacility.address,
      facilityLat: valleyFacility.lat ?? undefined,
      facilityLng: valleyFacility.lng ?? undefined,
      department: "EP Lab",
      physicianName: "Dr. Sarah Chen",
      patientName: "Robert Martinez",
      patientDOB: new Date("1958-03-12"),
      procedureType: "ICD",
      product: "ICD",
      urgency: "EMERGENCY",
      scheduledAt: hoursFromNow(1),
      status: "ASSIGNED",
      notes: "STAT — device advisory case, need rep ASAP",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 8 },
      { status: "ASSIGNED", note: `Assigned to ${repMike.name}`, minutesAgo: 6 },
    ]
  );

  // 2. Same day — accepted, rep should mark en route
  const sameDay = await createRequest(
    {
      providerId: provider.id,
      companyId: medtronic.id,
      assignedRepId: repMike.id,
      facilityName: valleyFacility.name,
      facilityAddr: valleyFacility.address,
      facilityLat: valleyFacility.lat ?? undefined,
      facilityLng: valleyFacility.lng ?? undefined,
      department: "EP Lab",
      physicianName: "Dr. Sarah Chen",
      patientName: "Patricia Nguyen",
      patientDOB: new Date("1972-07-22"),
      procedureType: "PPM",
      product: "PPM",
      urgency: "SAME_DAY",
      scheduledAt: hoursFromNow(4),
      status: "ACCEPTED",
      notes: "Dual-chamber PPM upgrade",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 45 },
      { status: "ASSIGNED", note: `Assigned to ${repMike.name}`, minutesAgo: 40 },
      { status: "ACCEPTED", note: "Rep accepted request", minutesAgo: 35 },
    ]
  );

  // 3. En route — with ETA
  const enRoute = await createRequest(
    {
      providerId: provider.id,
      companyId: medtronic.id,
      assignedRepId: repMike.id,
      facilityName: valleyFacility.name,
      facilityAddr: valleyFacility.address,
      facilityLat: valleyFacility.lat ?? undefined,
      facilityLng: valleyFacility.lng ?? undefined,
      department: "Cath Lab",
      physicianName: "Dr. Sarah Chen",
      patientName: "William Foster",
      patientDOB: new Date("1965-11-08"),
      procedureType: "CRT-D",
      product: "CRT-D",
      urgency: "SCHEDULED",
      scheduledAt: hoursFromNow(2),
      status: "EN_ROUTE",
      etaMinutes: 18,
      repLat: 33.43,
      repLng: -111.95,
      notes: "CRT-D implant, bring backup leads",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 120 },
      { status: "ASSIGNED", note: `Assigned to ${repMike.name}`, minutesAgo: 115 },
      { status: "ACCEPTED", note: "Rep accepted", minutesAgo: 110 },
      { status: "EN_ROUTE", note: "Rep en route", minutesAgo: 20 },
    ]
  );

  // 4. Arrived — rep should complete case
  const arrived = await createRequest(
    {
      providerId: provider.id,
      companyId: medtronic.id,
      assignedRepId: repMike.id,
      facilityName: valleyFacility.name,
      facilityAddr: valleyFacility.address,
      facilityLat: valleyFacility.lat ?? undefined,
      facilityLng: valleyFacility.lng ?? undefined,
      department: "EP Lab",
      physicianName: "Dr. Sarah Chen",
      patientName: "Susan Miller",
      patientDOB: new Date("1949-01-30"),
      procedureType: "Loop",
      product: "Loop",
      urgency: "SCHEDULED",
      scheduledAt: hoursFromNow(0.5),
      status: "ARRIVED",
      notes: "Loop recorder implant",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 180 },
      { status: "ASSIGNED", note: `Assigned to ${repMike.name}`, minutesAgo: 175 },
      { status: "ACCEPTED", note: "Rep accepted", minutesAgo: 170 },
      { status: "EN_ROUTE", note: "Rep en route", minutesAgo: 60 },
      { status: "ARRIVED", note: "Rep arrived on site", minutesAgo: 10 },
    ]
  );

  // 5. Completed — shows in history
  await createRequest(
    {
      providerId: provider.id,
      companyId: medtronic.id,
      assignedRepId: repMike.id,
      facilityName: valleyFacility.name,
      facilityAddr: valleyFacility.address,
      department: "EP Lab",
      physicianName: "Dr. Sarah Chen",
      patientName: "James Wilson",
      patientDOB: new Date("1955-09-14"),
      procedureType: "ICD",
      product: "ICD",
      urgency: "SCHEDULED",
      scheduledAt: daysFromNow(-2, 14),
      status: "COMPLETED",
      notes: "Successful ICD generator change",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 3000 },
      { status: "ASSIGNED", note: `Assigned to ${repMike.name}`, minutesAgo: 2980 },
      { status: "ACCEPTED", note: "Rep accepted", minutesAgo: 2970 },
      { status: "EN_ROUTE", note: "Rep en route", minutesAgo: 2900 },
      { status: "ARRIVED", note: "Rep arrived", minutesAgo: 2880 },
      { status: "COMPLETED", note: "Case completed", minutesAgo: 2700 },
    ]
  );

  // 6. Cancelled
  await createRequest(
    {
      providerId: provider.id,
      companyId: medtronic.id,
      assignedRepId: repMike.id,
      facilityName: valleyFacility.name,
      facilityAddr: valleyFacility.address,
      department: "EP Lab",
      physicianName: "Dr. Sarah Chen",
      patientName: "Maria Garcia",
      patientDOB: new Date("1968-04-05"),
      procedureType: "Extraction",
      urgency: "SCHEDULED",
      scheduledAt: daysFromNow(3, 9),
      status: "CANCELLED",
      notes: "Case cancelled — patient rescheduled",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 500 },
      { status: "CANCELLED", note: "Cancelled by provider", minutesAgo: 480 },
    ]
  );

  // 7. Boston Scientific — assigned to Tom (for provider2 / different company test)
  await createRequest(
    {
      providerId: provider2.id,
      companyId: boston.id,
      assignedRepId: repTom.id,
      facilityName: desertFacility.name,
      facilityAddr: desertFacility.address,
      facilityLat: desertFacility.lat ?? undefined,
      facilityLng: desertFacility.lng ?? undefined,
      department: "Cath Lab",
      physicianName: "Dr. James Park",
      patientName: "David Chen",
      patientDOB: new Date("1960-12-01"),
      procedureType: "Watchman",
      product: "Watchman",
      urgency: "SCHEDULED",
      scheduledAt: daysFromNow(1, 11),
      status: "ASSIGNED",
      notes: "Watchman LAA closure",
    },
    [
      { status: "SEARCHING", note: "Request submitted", minutesAgo: 30 },
      { status: "ASSIGNED", note: `Assigned to ${repTom.name}`, minutesAgo: 25 },
    ]
  );

  // Notifications
  await db.notification.createMany({
    data: [
      {
        userId: repMike.id,
        title: "New Rep Request",
        body: `Emergency ICD case at ${valleyFacility.name}`,
        type: "REQUEST_ASSIGNED",
        data: { requestId: emergency.id },
        read: false,
      },
      {
        userId: repMike.id,
        title: "Request Accepted",
        body: "Same-day PPM case confirmed",
        type: "REQUEST_STATUS",
        data: { requestId: sameDay.id },
        read: true,
      },
      {
        userId: provider.id,
        title: "Rep En Route",
        body: `${repMike.name} is en route — ETA 18 min`,
        type: "REQUEST_STATUS",
        data: { requestId: enRoute.id },
        read: false,
      },
      {
        userId: provider.id,
        title: "Rep Arrived",
        body: `${repMike.name} arrived for Loop case`,
        type: "REQUEST_STATUS",
        data: { requestId: arrived.id },
        read: false,
      },
    ],
  });

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                   GoRepYo Demo Test Data Ready                   ║
╚══════════════════════════════════════════════════════════════════╝

Run:  nvm use && npm run dev
Seed: npm run db:seed   (re-run anytime to reset demo data)

All demo passwords: ${DEMO_PASSWORD}

ACCOUNTS
──────────────────────────────────────────────────────────────────
  Provider (main)     provider@demo.com     → /provider
  Provider (alt)      provider2@demo.com    → /provider
  Rep (Medtronic)     rep@demo.com          → /rep   Mike Rodriguez, AVAILABLE
  Rep (Medtronic)     rep2@demo.com         → /rep   Lisa Wong, BUSY
  Rep (Boston Sci)    rep3@demo.com         → /rep   Tom Hayes, AVAILABLE
  Company admin       admin@demo.com        → /company   (Medtronic)
  Company admin       admin2@demo.com       → /company   (Boston Scientific)
  Platform admin      super@demo.com        → /admin

SEEDED CASES (sign in as provider@demo.com)
──────────────────────────────────────────────────────────────────
  1. EMERGENCY / ICD      → ASSIGNED    Accept as rep@demo.com
  2. SAME DAY / PPM       → ACCEPTED    Mark En Route as rep
  3. SCHEDULED / CRT-D    → EN ROUTE    Track ETA on provider dashboard
  4. SCHEDULED / Loop     → ARRIVED     Complete Case as rep
  5. SCHEDULED / ICD      → COMPLETED   View in Requests → Completed tab
  6. SCHEDULED / Extract  → CANCELLED   View in Requests → Cancelled tab

  provider2@demo.com has 1 Watchman case (Boston Sci) assigned to rep3@demo.com

TEST WALKTHROUGH
──────────────────────────────────────────────────────────────────
  A. Provider (provider@demo.com)
     • Dashboard → see 4 active cases + status pipeline
     • Request a Rep → submit new case (pick Medtronic for auto-assign)
     • Requests → filter All / Active / Completed / Cancelled
     • Favorites → Mike Rodriguez is favorited → Quick Request

  B. Rep (rep@demo.com)
     • Dashboard → toggle Available / On Call
     • Accept the EMERGENCY case → Mark En Route → Arrived → Complete
     • Schedule → see today's grouped cases
     • Territory → edit coverage & products → Save

  C. Company (admin@demo.com)
     • Overview → rep & case stats
     • Reps → change Lisa Wong credential status
     • Analytics → procedure breakdown & response times

  D. Platform (super@demo.com)
     • Tenants → add/toggle companies
     • Users → change roles

  E. End-to-end live flow
     1. provider@demo.com → Request a Rep (Medtronic, PPM, Same Day)
     2. rep@demo.com → Accept → En Route → Arrived → Complete
     3. provider@demo.com → watch status update in real time
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
