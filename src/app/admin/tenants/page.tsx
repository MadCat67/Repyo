import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminTenantsPage } from "@/components/admin/admin-pages";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");
  return <AdminTenantsPage userName={session.user.name} />;
}
