import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RepDashboard } from "@/components/rep/rep-dashboard";

export default async function RepPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") {
    redirect("/login");
  }

  return <RepDashboard userName={session.user.name} />;
}
