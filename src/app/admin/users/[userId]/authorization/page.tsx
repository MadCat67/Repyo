import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { AuthorizationDossierLoader } from "@/components/authorization/authorization-dossier";

type PageProps = { params: Promise<{ userId: string }> };

export default async function AdminUserAuthorizationPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const { userId } = await params;

  return (
    <PortalShell portal="admin" userName={session.user.name}>
      <AuthorizationDossierLoader
        apiPath={`/api/admin/users/${userId}/authorization`}
        backHref="/admin/users"
        backLabel="All users"
      />
    </PortalShell>
  );
}
