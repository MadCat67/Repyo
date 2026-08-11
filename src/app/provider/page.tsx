import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProviderDashboard } from "@/components/provider/provider-dashboard";

export default async function ProviderPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") {
    redirect("/login");
  }

  const profile = await db.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <ProviderDashboard
      userName={session.user.name}
      defaultFacility={{
        name: profile?.facilityName ?? undefined,
        address: profile?.facilityAddress ?? undefined,
        phone: profile?.facilityPhone ?? undefined,
        department: profile?.department ?? undefined,
        physician: profile?.defaultPhysician ?? undefined,
      }}
    />
  );
}
