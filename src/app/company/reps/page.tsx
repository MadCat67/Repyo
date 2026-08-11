import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CompanyRepsPage } from "@/components/company/company-pages";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") redirect("/login");

  const companyId = session.user.companyId;
  if (!companyId) redirect("/login");

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true, products: true },
  });

  return (
    <CompanyRepsPage
      userName={session.user.name}
      companyName={company?.name ?? "Company"}
      companyProducts={company?.products ?? []}
    />
  );
}
