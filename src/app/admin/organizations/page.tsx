import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminOrganizationsPage } from "@/components/admin/admin-organizations";

export default async function OrganizationsAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return <AdminOrganizationsPage userName={session.user.name} />;
}
