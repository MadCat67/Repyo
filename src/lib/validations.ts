import { z } from "zod";
import { RequestType, RequestUrgency } from "@prisma/client";

const zipSchema = z.string().regex(/^\d{5}$/, "Valid 5-digit zip code required");

export const createRequestSchema = z
  .object({
    companyId: z.string().uuid(),
    facilityName: z.string().min(1, "Facility name is required"),
    facilityAddr: z.string().min(1, "Facility address is required"),
    facilityZipCode: zipSchema,
    facilityContactName: z.string().min(1, "Facility contact name is required"),
    facilityContactPhone: z.string().min(1, "Facility contact phone is required"),
    department: z.string().optional(),
    facilityPhone: z.string().optional(),
    facilityLat: z.number().optional(),
    facilityLng: z.number().optional(),
    requesterName: z.string().min(1, "Requester name is required"),
    requesterPhone: z.string().min(1, "Requester phone is required"),
    requesterEmail: z.string().email("Valid requester email required"),
    requesterFax: z.string().optional(),
    requestType: z.nativeEnum(RequestType),
    procedureType: z.string().optional(),
    patientName: z.string().optional(),
    patientDOB: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isNaN(Date.parse(v)),
        "Invalid date"
      ),
    patientRoom: z.string().optional(),
    product: z.string().optional(),
    urgency: z.nativeEnum(RequestUrgency).optional(),
    scheduledAt: z.string().datetime(),
    notes: z.string().optional(),
    preferredRepId: z.string().uuid().optional(),
    repInitiated: z.boolean().optional(),
    assignRepId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestType === "CASE") {
      if (!data.procedureType?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Procedure type is required",
          path: ["procedureType"],
        });
      }
      if (!data.patientName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Patient name is required",
          path: ["patientName"],
        });
      }
      if (!data.patientDOB?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Patient date of birth is required",
          path: ["patientDOB"],
        });
      }
      if (!data.patientRoom?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Patient room number is required",
          path: ["patientRoom"],
        });
      }
    } else if (!data.notes?.trim() && !data.procedureType?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Appointment details are required",
        path: ["notes"],
      });
    }

    if (data.repInitiated && !data.assignRepId && !data.preferredRepId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a rep to assign this request to",
        path: ["assignRepId"],
      });
    }
  });

export const updateRequestStatusSchema = z.object({
  status: z.enum([
    "REQUESTING",
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

export const assignRepSchema = z.object({
  repId: z.string().uuid(),
});

export const updateDelegationSchema = z.object({
  repId: z.string().uuid().nullable(),
  active: z.boolean(),
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

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format");

export const updateScheduleRulesSchema = z.object({
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: timeSchema,
      endTime: timeSchema,
    })
  ),
});

export const createAvailabilityBlockSchema = z.object({
  type: z.enum(["VACATION", "OFF"]).default("VACATION"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  note: z.string().optional(),
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
    facilityAddress: z.string().optional(),
    department: z.string().optional(),
    zipCode: z.string().optional(),
    facilityContactName: z.string().optional(),
    facilityContactPhone: z.string().optional(),
    requesterPhone: z.string().optional(),
    requesterFax: z.string().optional(),
    zipCodeStart: z.string().optional(),
    zipCodeEnd: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (["REP", "COMPANY_ADMIN"].includes(data.role) && !data.companyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Device company is required for this role",
        path: ["companyId"],
      });
    }
    if (data.role === "PROVIDER") {
      const required: { key: keyof typeof data; label: string }[] = [
        { key: "facilityName", label: "Facility name" },
        { key: "facilityAddress", label: "Facility address" },
        { key: "zipCode", label: "Zip code" },
        { key: "facilityContactName", label: "Facility contact name" },
        { key: "facilityContactPhone", label: "Facility contact phone" },
        { key: "requesterPhone", label: "Your phone number" },
      ];
      for (const field of required) {
        const value = data[field.key];
        if (typeof value !== "string" || !value.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.label} is required for providers`,
            path: [field.key],
          });
        }
      }
    }
    if (data.role === "COMPANY_ADMIN") {
      if (!data.zipCodeStart?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Starting zip code is required for company admins",
          path: ["zipCodeStart"],
        });
      }
      if (!data.zipCodeEnd?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ending zip code is required for company admins",
          path: ["zipCodeEnd"],
        });
      }
    }
  });
