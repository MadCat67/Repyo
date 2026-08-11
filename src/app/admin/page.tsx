import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/portal-shell";
import { redirect } from "next/navigation";
import { Building2, Users, Stethoscope, Activity } from "lucide-react";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const [companies, users, requests, activeRequests] = await Promise.all([
    db.company.count(),
    db.user.count(),
    db.serviceRequest.count(),
    db.serviceRequest.count({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
  ]);

  const stats = [
    { label: "Device Companies", value: companies, icon: Building2 },
    { label: "Platform Users", value: users, icon: Users },
    { label: "Total Requests", value: requests, icon: Stethoscope },
    { label: "Active Requests", value: activeRequests, icon: Activity },
  ];

  return (
    <PortalShell portal="admin" userName={session.user.name}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Admin</h1>
        <p className="text-sm text-slate-600">System monitoring & tenant management</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{stat.label}</p>
              <stat.icon className="h-5 w-5 text-rose-500" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
