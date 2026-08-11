"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in..." : "Sign In"}
    </Button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const sessionError = searchParams.get("error") === "session";
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-rose-600">RepYo</h1>
          <p className="mt-2 text-sm text-slate-600">
            Healthcare rep dispatch platform
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          {sessionError && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your session expired. Sign in again to continue.
            </div>
          )}
          {state?.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
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
          <SubmitButton />
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
          <p className="pt-2 text-slate-400">
            To test provider and company side-by-side, use a normal window for one
            role and an incognito window for the other.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
