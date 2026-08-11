import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RepSchedulePage } from "@/components/rep/rep-dashboard";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") redirect("/login");
  return <RepSchedulePage userName={session.user.name} />;
}
