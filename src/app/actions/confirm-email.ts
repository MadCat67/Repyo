"use server";

import { completeSignup } from "@/lib/signup/complete-signup";
import {
  consumePendingSignup,
  deletePendingSignup,
} from "@/lib/signup/pending-signup";
import type { SignupPayload } from "@/lib/signup/types";

export async function confirmEmailSignup(token: string) {
  const result = await consumePendingSignup(token);
  if (!result.ok) {
    return { error: result.error };
  }

  const payload = result.payload as SignupPayload;

  try {
    await completeSignup({
      email: result.pending.email,
      passwordHash: result.pending.passwordHash,
      payload,
      invitationId: result.pending.invitationId,
    });
    await deletePendingSignup(result.pending.id);

    return {
      ok: true as const,
      pendingApproval: payload.requireManualApproval ?? false,
      role: payload.role,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not create account",
    };
  }
}
