import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompanyTeamsPage } from "@/components/company/company-teams";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    redirect("/login");
  }
  return <CompanyTeamsPage userName={session.user.name ?? "Manager"} />;
}
