import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main-content" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex items-center justify-between text-sm">
          <Link href="/sessions/new" className="font-medium text-slate-700 hover:text-slate-900">
            + Capture a build session
          </Link>
          <form action={logout}>
            <button type="submit" className="text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </form>
        </div>
        {children}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>DevLogue - evidence first. AI drafts never publish themselves.</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link className="font-medium text-slate-600 hover:text-slate-900" href="/operations/errors">Incident ledger</Link>
            <Link className="font-medium text-slate-600 hover:text-slate-900" href="/operations/errors/report">Report a problem</Link>
            <Link className="font-medium text-slate-600 hover:text-slate-900" href="/help">Help and user guide</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
