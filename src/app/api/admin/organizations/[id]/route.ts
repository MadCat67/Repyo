import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};

  if (body.status) data.status = body.status;
  if (body.complianceMode) data.complianceMode = body.complianceMode;
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail;
  if (body.userVerificationMethod) data.userVerificationMethod = body.userVerificationMethod;
  if (body.approvedEmailDomains !== undefined) {
    data.approvedEmailDomains = Array.isArray(body.approvedEmailDomains)
      ? body.approvedEmailDomains.map((d: string) =>
          d.trim().toLowerCase().replace(/^@/, "")
        )
      : [];
  }
  if (body.ssoEnabled !== undefined) data.ssoEnabled = Boolean(body.ssoEnabled);
  if (body.scimEnabled !== undefined) data.scimEnabled = Boolean(body.scimEnabled);

  if (body.status === "VERIFIED" && !body.skipVerifiedAt) {
    data.verifiedAt = new Date();
  }
  if (body.baaExecuted) data.baaExecutedAt = new Date();
  if (body.orgAgreement) data.orgAgreementAt = new Date();
  if (body.phiEnabled) {
    data.phiEnabledAt = new Date();
    data.complianceMode = "PHI_ENABLED";
    data.status = "ACTIVATED";
  }

  const org = await db.providerOrganization.update({
    where: { id },
    data,
  });

  if (body.phiEnabled) {
    await db.providerProfile.updateMany({
      where: {
        organizationId: id,
        onboardingComplete: true,
        termsAcceptedAt: { not: null },
      },
      data: { accountStatus: "ACTIVE" },
    });
  }

  return NextResponse.json(org);
}
