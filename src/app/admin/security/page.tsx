import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSecurityPage } from "@/components/admin/admin-security";

export default async function SecurityAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return <AdminSecurityPage userName={session.user.name} />;
}
