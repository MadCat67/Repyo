import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProviderOnboardingPage } from "@/components/provider/provider-onboarding";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    redirect("/login");
  }

  const profile = await db.providerProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingComplete: true },
  });

  if (profile?.onboardingComplete) {
    redirect("/provider");
  }

  return <ProviderOnboardingPage userName={session.user.name} />;
}
