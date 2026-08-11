import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminUsersPage } from "@/components/admin/admin-pages";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");
  return <AdminUsersPage userName={session.user.name} />;
}
