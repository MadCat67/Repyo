import { randomBytes } from "crypto";

export function generateEmailConfirmToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildEmailConfirmUrl(token: string, baseUrl?: string): string {
  const origin =
    baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Sends signup confirmation email. Logs link in development when SMTP is not configured. */
export async function sendSignupConfirmationEmail(params: {
  to: string;
  name: string;
  confirmToken: string;
}): Promise<void> {
  const url = buildEmailConfirmUrl(params.confirmToken);

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: params.to,
        subject: "Confirm your RepYo account",
        html: `<p>Hi ${params.name},</p><p>Confirm your email to finish creating your RepYo account:</p><p><a href="${url}">Confirm email</a></p><p>This link expires in 24 hours.</p>`,
      }),
    });
    return;
  }

  console.info(
    `[RepYo] Signup confirmation for ${params.to} — open to confirm:\n${url}`
  );
}
