"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/auth-utils";
import { signupAction } from "@/app/actions/auth";
import type { Role } from "@prisma/client";

interface Company {
  id: string;
  name: string;
}

const SIGNUP_ROLES: Role[] = ["PROVIDER", "REP", "COMPANY_ADMIN"];

export function SignupForm() {
  const [role, setRole] = useState<Role>("PROVIDER");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/companies/public")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Company[]) => setCompanies(data))
      .catch(() => setCompanies([]));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    form.set("role", role);

    const result = await signupAction(form);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  const needsCompany = role === "REP" || role === "COMPANY_ADMIN";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-rose-600">RepYo</h1>
          <p className="mt-2 text-sm text-slate-600">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Select
            label="I am a..."
            name="roleDisplay"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={SIGNUP_ROLES.map((r) => ({
              value: r,
              label: ROLE_LABELS[r],
            }))}
          />

          <Input label="Full Name" name="name" required autoComplete="name" />
          <Input
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />

          {role === "PROVIDER" && (
            <>
              <Input
                label="Facility / Hospital (optional)"
                name="facilityName"
                autoComplete="organization"
              />
              <Input label="Department (optional)" name="department" />
            </>
          )}

          {needsCompany && (
            <Select
              label="Device Company"
              name="companyId"
              required
              options={[
                {
                  value: "",
                  label: companies.length
                    ? "Select a company"
                    : "Loading companies...",
                },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-rose-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
