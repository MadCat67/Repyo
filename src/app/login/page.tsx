"use client";

import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const sessionError = searchParams.get("error") === "session";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string)?.trim().toLowerCase();
    const password = form.get("password") as string;

    if (!email || !password) {
      setError("Email and password are required");
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      const safeCallback =
        callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/";

      router.push(safeCallback);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <BrandMark size="lg" className="justify-center" />
          <p className="mt-2 text-sm text-slate-600">
            Healthcare rep dispatch platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {sessionError && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your session expired. Sign in again to continue.
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@hospital.org"
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-rose-600 hover:underline">
            Sign up
          </Link>
        </p>

        <div className="mt-4 space-y-1 text-center text-xs text-slate-500">
          <p>Demo accounts (password: demo123)</p>
          <p>
            <span className="font-medium text-slate-600">Provider:</span> provider@demo.com
          </p>
          <p>
            <span className="font-medium text-slate-600">Rep:</span> rep@demo.com ·{" "}
            <span className="font-medium text-slate-600">Company admin:</span> admin@demo.com
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
