import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProviderCalendarPage } from "@/components/provider/provider-calendar";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PROVIDER") redirect("/login");
  return <ProviderCalendarPage userName={session.user.name} />;
}
