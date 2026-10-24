import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { OtpLoginForm } from "@/components/otp-login-form";
import { hasSession, isAuthConfigured, ownerEmail } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";

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
          {otpEnabled ? <OtpLoginForm ownerEmail={ownerEmail()} /> : <LoginForm configured={isAuthConfigured()} />}
        </div>

        {otpEnabled ? (
          <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Use the password instead
            </summary>
            <div className="pt-4">
              <LoginForm configured={isAuthConfigured()} />
            </div>
          </details>
        ) : (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-500">
            Email codes are enabled when <code className="font-mono">RESEND_API_KEY</code> is set.
          </p>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          Single-user workspace. Nothing is published without explicit approval.
        </p>
      </div>
    </main>
  );
}
