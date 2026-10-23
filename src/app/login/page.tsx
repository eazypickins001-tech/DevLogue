import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { hasSession, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await hasSession()) redirect("/dashboard");

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
          <LoginForm configured={isAuthConfigured()} />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Single-user workspace. Nothing is published without explicit approval.
        </p>
      </div>
    </main>
  );
}
