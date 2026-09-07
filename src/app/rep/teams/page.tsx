import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RepTeamsPage } from "@/components/rep/rep-teams";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") {
    redirect("/login");
  }
  return <RepTeamsPage userName={session.user.name ?? "Rep"} userId={session.user.id} />;
}
