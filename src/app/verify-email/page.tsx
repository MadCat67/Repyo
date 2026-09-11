import Link from "next/link";
import { confirmEmailSignup } from "@/app/actions/confirm-email";
import { BrandMark } from "@/components/shared/brand-mark";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <VerifyShell
        title="Invalid link"
        message="This confirmation link is missing or invalid."
      />
    );
  }

  const result = await confirmEmailSignup(token);

  if (result.error) {
    return <VerifyShell title="Confirmation failed" message={result.error} />;
  }

  if (result.pendingApproval) {
    return (
      <VerifyShell
        title="Email confirmed"
        message="Your account was created. An administrator must approve your access before you can use RepYo. You'll be notified when approved."
        showLogin
      />
    );
  }

  return (
    <VerifyShell
      title="Email confirmed"
      message="Your account is ready. Sign in to continue."
      showLogin
    />
  );
}

function VerifyShell({
  title,
  message,
  showLogin,
}: {
  title: string;
  message: string;
  showLogin?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <BrandMark className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {showLogin && (
          <Link
            href="/login"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
