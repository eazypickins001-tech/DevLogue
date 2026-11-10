import { redirect } from "next/navigation";
import { OtpLoginForm } from "@/components/otp-login-form";
import { hasSession, isAuthConfigured, ownerEmail } from "@/lib/auth";
import { isDevOutbox, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await hasSession()) redirect("/dashboard");
  const otpEnabled = isAuthConfigured() && isEmailConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            DL
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">DevLogue</h1>
            <p className="text-xs text-slate-500">Build in public, from real work.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {otpEnabled ? (
            <OtpLoginForm defaultEmail={ownerEmail()} devOutbox={isDevOutbox()} />
          ) : (
            <p className="text-sm text-slate-600">
              Sign-in is not configured. Set <code className="font-mono">AUTH_SECRET</code> and{" "}
              <code className="font-mono">RESEND_API_KEY</code> in the environment.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Accounts are created on first sign-in. Nothing is published without explicit approval.
        </p>
      </div>
    </main>
  );
}
