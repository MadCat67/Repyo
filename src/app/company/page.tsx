import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/portal-shell";
import { redirect } from "next/navigation";
import { Users, Clock, MapPin, Activity, ArrowRight } from "lucide-react";

export default async function CompanyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "COMPANY_ADMIN") {
    redirect("/login");
  }

  const companyId = session.user.companyId;
  if (!companyId) redirect("/login");

  const [reps, requests, company] = await Promise.all([
    db.user.count({ where: { companyId, role: "REP" } }),
    db.serviceRequest.findMany({
      where: { companyId },
      select: { status: true, createdAt: true },
    }),
    db.company.findUnique({ where: { id: companyId } }),
  ]);

  const activeReps = await db.repProfile.count({
    where: {
      user: { companyId },
      status: "AVAILABLE",
      credentialStatus: "ACTIVE",
    },
  });

  const completed = requests.filter((r) => r.status === "COMPLETED").length;
  const active = requests.filter(
    (r) => !["COMPLETED", "CANCELLED"].includes(r.status)
  ).length;

  const stats = [
    { label: "Total Reps", value: reps, icon: Users },
    { label: "Available Now", value: activeReps, icon: Activity },
    { label: "Active Requests", value: active, icon: Clock },
    { label: "Completed Cases", value: completed, icon: MapPin },
  ];

  return (
    <PortalShell portal="company" userName={session.user.name}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{company?.name}</h1>
        <p className="text-sm text-slate-600">Company Operations Overview</p>
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

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Provider Requests</h2>
            <p className="mt-2 text-sm text-slate-600">
              {active} active case{active !== 1 ? "s" : ""} from healthcare providers
            </p>
          </div>
          <Link
            href="/company/requests"
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            View Requests
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </PortalShell>
  );
}
