import { validateInvitationToken } from "@/lib/invitations/service";
import { buildInviteUrl } from "@/lib/invitations/constants";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = await validateInvitationToken(token);
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }

  return NextResponse.json({
    valid: true,
    invitation: result.invitation,
    inviteUrl: buildInviteUrl(token),
  });
}
