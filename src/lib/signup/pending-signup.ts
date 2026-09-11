import { db } from "@/lib/db";
import { generateEmailConfirmToken } from "@/lib/email/send-confirmation";
import type { SignupPayload } from "@/lib/signup/types";

const PENDING_SIGNUP_HOURS = 24;

export async function createPendingSignup(params: {
  email: string;
  passwordHash: string;
  payload: SignupPayload;
  invitationId?: string | null;
}) {
  const confirmToken = generateEmailConfirmToken();
  const expiresAt = new Date(Date.now() + PENDING_SIGNUP_HOURS * 60 * 60 * 1000);

  await db.pendingSignup.deleteMany({
    where: { email: params.email.trim().toLowerCase() },
  });

  const pending = await db.pendingSignup.create({
    data: {
      confirmToken,
      email: params.email.trim().toLowerCase(),
      passwordHash: params.passwordHash,
      payload: params.payload,
      invitationId: params.invitationId ?? null,
      expiresAt,
    },
  });

  return { pending, confirmToken };
}

export async function consumePendingSignup(token: string) {
  const pending = await db.pendingSignup.findUnique({
    where: { confirmToken: token },
  });

  if (!pending) {
    return { ok: false as const, error: "Confirmation link is invalid or expired" };
  }

  if (pending.expiresAt < new Date()) {
    await db.pendingSignup.delete({ where: { id: pending.id } });
    return { ok: false as const, error: "Confirmation link has expired" };
  }

  return {
    ok: true as const,
    pending,
    payload: pending.payload as SignupPayload,
  };
}

export async function deletePendingSignup(id: string) {
  await db.pendingSignup.delete({ where: { id } }).catch(() => undefined);
}
