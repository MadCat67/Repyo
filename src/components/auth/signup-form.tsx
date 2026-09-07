"use client";

import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
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

interface Organization {
  id: string;
  name: string;
  status: string;
  complianceMode: string;
}

const SIGNUP_ROLES: Role[] = ["PROVIDER", "REP", "COMPANY_ADMIN"];

export function SignupForm() {
  const [role, setRole] = useState<Role>("PROVIDER");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [requestOrgAccess, setRequestOrgAccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/companies/public")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Company[]) => setCompanies(data))
      .catch(() => setCompanies([]));

    fetch("/api/provider/organizations")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Organization[]) => setOrganizations(data))
      .catch(() => setOrganizations([]));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    form.set("role", role);
    form.set("requestOrgAccess", requestOrgAccess ? "true" : "false");

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
          <BrandMark size="lg" />
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Healthcare Organization
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Select your verified hospital or request access if not yet on GoRepYo.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requestOrgAccess}
                  onChange={(e) => setRequestOrgAccess(e.target.checked)}
                />
                My organization is not yet activated for GoRepYo
              </label>

              {requestOrgAccess ? (
                <>
                  <Input
                    label="Hospital / Organization Name"
                    name="requestedOrgName"
                    required
                    placeholder="e.g. Desert Regional Medical Center"
                  />
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    You may create your profile, but patient information cannot be
                    submitted until your organization completes verification and
                    required agreements. GoRepYo will notify you when activated.
                  </div>
                </>
              ) : (
                <Select
                  label="Healthcare Organization"
                  name="organizationId"
                  required
                  options={[
                    {
                      value: "",
                      label: organizations.length
                        ? "Select organization..."
                        : "Loading organizations...",
                    },
                    ...organizations.map((o) => ({
                      value: o.id,
                      label: `${o.name}${o.complianceMode === "PHI_ENABLED" && o.status === "ACTIVATED" ? " (PHI Enabled)" : ""}`,
                    })),
                  ]}
                />
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Facility Information
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Used to pre-fill request forms after signup.
                </p>
              </div>
              <Input
                label="Hospital Name"
                name="facilityName"
                required
                autoComplete="organization"
              />
              <Input
                label="Facility Address"
                name="facilityAddress"
                required
                autoComplete="street-address"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Department" name="department" />
                <Input
                  label="Zip Code"
                  name="zipCode"
                  required
                  placeholder="85044"
                  pattern="\d{5}"
                  maxLength={5}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Facility Contact Name"
                  name="facilityContactName"
                  required
                />
                <Input
                  label="Facility Contact Phone"
                  name="facilityContactPhone"
                  type="tel"
                  required
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Your Information (Requester)
                </p>
              </div>
              <Input
                label="Your Phone"
                name="requesterPhone"
                type="tel"
                required
                autoComplete="tel"
              />
              <Input label="Your Fax (optional)" name="requesterFax" type="tel" />
            </>
          )}

          {role === "COMPANY_ADMIN" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Zip Range Start"
                name="zipCodeStart"
                required
                placeholder="85040"
                pattern="\d{5}"
                maxLength={5}
              />
              <Input
                label="Zip Range End"
                name="zipCodeEnd"
                required
                placeholder="85050"
                pattern="\d{5}"
                maxLength={5}
              />
            </div>
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
