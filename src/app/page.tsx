import { auth } from "@/lib/auth";
import { getDefaultRoute } from "@/lib/auth-utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Shield, Stethoscope, Users, Building2, Zap } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect(getDefaultRoute(session.user.role));
  }

  const portals = [
    {
      role: "Healthcare Provider",
      desc: "Request reps, track cases, manage favorites",
      href: "/login",
      icon: Stethoscope,
    },
    {
      role: "Device Representative",
      desc: "Accept requests, manage availability, navigate",
      href: "/login",
      icon: Users,
    },
    {
      role: "Company Admin",
      desc: "Manage reps, territories, and analytics",
      href: "/login",
      icon: Building2,
    },
    {
      role: "Platform Admin",
      desc: "Tenant management and system monitoring",
      href: "/login",
      icon: Shield,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-2xl font-bold text-rose-600">RepYo</span>
          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-rose-600"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">
            <Zap className="h-4 w-4" />
            HIPAA-compliant rep dispatch
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Connect providers with credentialed device reps
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Intelligent routing, real-time tracking, and streamlined scheduling
            for cath lab, EP lab, and OR procedures.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 font-medium text-white hover:bg-rose-700"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2">
          {portals.map((portal) => (
            <Link
              key={portal.role}
              href={portal.href}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-rose-200 hover:shadow-md"
            >
              <portal.icon className="h-8 w-8 text-rose-500" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{portal.role}</h3>
              <p className="mt-2 text-sm text-slate-600">{portal.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
