import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RepTerritoryPage } from "@/components/rep/rep-territory";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") redirect("/login");
  return <RepTerritoryPage userName={session.user.name} />;
}
