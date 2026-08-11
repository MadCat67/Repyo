import { z } from "zod";
import { RequestType, RequestUrgency } from "@prisma/client";

export const createRequestSchema = z.object({
  companyId: z.string().uuid(),
  facilityName: z.string().min(1),
  facilityAddr: z.string().min(1),
  facilityPhone: z.string().optional(),
  facilityLat: z.number().optional(),
  facilityLng: z.number().optional(),
  department: z.string().min(1),
  physicianName: z.string().min(1),
  patientName: z.string().min(1),
  patientDOB: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  procedureType: z.string().min(1),
  requestType: z.nativeEnum(RequestType).default("CASE"),
  product: z.string().optional(),
  urgency: z.nativeEnum(RequestUrgency),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  preferredRepId: z.string().uuid().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum([
    "SEARCHING",
    "ASSIGNED",
    "PENDING",
    "ACCEPTED",
    "EN_ROUTE",
    "ARRIVED",
    "COMPLETED",
    "CANCELLED",
  ]),
  lat: z.number().optional(),
  lng: z.number().optional(),
  note: z.string().optional(),
});

export const updateRepStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "BUSY", "OFF_DUTY", "VACATION"]),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updateRepLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const updateRepProfileSchema = z.object({
  status: z.enum(["AVAILABLE", "BUSY", "OFF_DUTY", "VACATION"]).optional(),
  onCallEnabled: z.boolean().optional(),
  travelRadiusMiles: z.number().min(1).max(500).optional(),
  maxTravelDistance: z.number().min(1).max(500).optional(),
  products: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updateTerritorySchema = z.object({
  territories: z.array(
    z.object({
      state: z.string().optional(),
      county: z.string().optional(),
      zipCode: z.string().optional(),
    })
  ),
});

export const updateRepCredentialSchema = z.object({
  credentialStatus: z.enum(["ACTIVE", "PENDING", "EXPIRED", "REVOKED"]),
});

export const createRepSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  credentialStatus: z
    .enum(["ACTIVE", "PENDING", "EXPIRED", "REVOKED"])
    .default("ACTIVE"),
  status: z
    .enum(["AVAILABLE", "BUSY", "OFF_DUTY", "VACATION"])
    .default("AVAILABLE"),
  products: z.array(z.string()).default([]),
});

export const createCompanySchema = z.object({
  name: z.string().min(2),
  products: z.array(z.string()).default([]),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  products: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "COMPANY_ADMIN", "REP", "PROVIDER"]).optional(),
  companyId: z.string().uuid().nullable().optional(),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Valid email required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["PROVIDER", "REP", "COMPANY_ADMIN"]),
    companyId: z.string().uuid().optional(),
    facilityName: z.string().optional(),
    department: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (["REP", "COMPANY_ADMIN"].includes(data.role) && !data.companyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Device company is required for this role",
        path: ["companyId"],
      });
    }
  });
