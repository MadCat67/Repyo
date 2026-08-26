import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSalesforceConfig } from "@/lib/secrets";
import { getSalesforceAuthorizeUrl } from "@/lib/salesforce";
import { signSalesforceState } from "@/lib/salesforce-state";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await db.company.findUnique({
    where: { id: session.user.companyId },
    select: {
      salesforceConnectedAt: true,
      salesforceInstanceUrl: true,
    },
  });

  const config = getSalesforceConfig();

  return NextResponse.json({
    connected: Boolean(company?.salesforceConnectedAt),
    instanceUrl: company?.salesforceInstanceUrl ?? null,
    mockMode: config.mockMode,
    oauthConfigured: Boolean(config.clientId && config.clientSecret),
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = signSalesforceState({
    companyId: session.user.companyId,
    userId: session.user.id,
  });

  const url = getSalesforceAuthorizeUrl(state);
  if (!url) {
    return NextResponse.json(
      {
        error:
          "Salesforce OAuth is not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ authorizeUrl: url });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.company.update({
    where: { id: session.user.companyId },
    data: {
      salesforceInstanceUrl: null,
      salesforceAccessTokenEnc: null,
      salesforceRefreshTokenEnc: null,
      salesforceTokenExpiresAt: null,
      salesforceConnectedAt: null,
    },
  });

  return NextResponse.json({ disconnected: true });
}
