import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/secrets";
import { exchangeSalesforceCode } from "@/lib/salesforce";
import { verifySalesforceState } from "@/lib/salesforce-state";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const appUrl =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const redirectBase = `${appUrl.replace(/\/$/, "")}/company`;

  if (oauthError || !code || !state) {
    return NextResponse.redirect(
      `${redirectBase}?salesforce=error&message=${encodeURIComponent(oauthError ?? "Authorization cancelled")}`
    );
  }

  const parsed = verifySalesforceState(state);
  if (!parsed) {
    return NextResponse.redirect(`${redirectBase}?salesforce=error&message=Invalid+state`);
  }

  const tokens = await exchangeSalesforceCode(code);
  if (!tokens) {
    return NextResponse.redirect(
      `${redirectBase}?salesforce=error&message=${encodeURIComponent("Token exchange failed")}`
    );
  }

  await db.company.update({
    where: { id: parsed.companyId },
    data: {
      salesforceInstanceUrl: tokens.instanceUrl,
      salesforceAccessTokenEnc: encryptSecret(tokens.accessToken),
      salesforceRefreshTokenEnc: encryptSecret(tokens.refreshToken),
      salesforceTokenExpiresAt: new Date(Date.now() + 55 * 60 * 1000),
      salesforceConnectedAt: new Date(),
    },
  });

  return NextResponse.redirect(`${redirectBase}?salesforce=connected`);
}
