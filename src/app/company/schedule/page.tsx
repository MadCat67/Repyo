import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompanyCalendarPage } from "@/components/company/company-calendar";

export default async function CompanySchedulePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    redirect("/login");
  }

  return <CompanyCalendarPage userName={session.user.name} />;
}
