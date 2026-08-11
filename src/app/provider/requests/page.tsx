import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProviderRequestsPage } from "@/components/provider/provider-requests";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") redirect("/login");
  return <ProviderRequestsPage userName={session.user.name} />;
}
