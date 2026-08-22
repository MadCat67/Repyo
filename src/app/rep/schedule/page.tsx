import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RepCalendarPage } from "@/components/rep/rep-calendar";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "REP") redirect("/login");
  return <RepCalendarPage userName={session.user.name} />;
}
