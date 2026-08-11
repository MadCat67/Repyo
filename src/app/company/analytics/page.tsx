import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompanyAnalyticsPage } from "@/components/company/company-pages";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") redirect("/login");
  return <CompanyAnalyticsPage userName={session.user.name} />;
}
