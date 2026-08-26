import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return secret;
}

export function signSalesforceState(payload: {
  companyId: string;
  userId: string;
}): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySalesforceState(state: string): {
  companyId: string;
  userId: string;
} | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      companyId: string;
      userId: string;
    };
    if (!parsed.companyId || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}
