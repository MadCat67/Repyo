import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProviderFavoritesPage } from "@/components/provider/provider-favorites";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") redirect("/login");
  return <ProviderFavoritesPage userName={session.user.name} />;
}
