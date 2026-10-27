"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/errors/client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      route: window.location.pathname + window.location.search,
      action: "react-error-boundary",
      context: error.digest ? { digest: error.digest } : null,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-16">
      <div className="w-full rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Something failed</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          This page could not finish rendering.
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          The failure was recorded in the incident ledger. You can retry the page or return to the
          dashboard.
        </p>
        <p className="mt-3 rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
          {error.digest ?? error.message}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Dashboard
          </Link>
          <Link
            href="/operations/errors"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Incident ledger
          </Link>
        </div>
      </div>
    </main>
  );
}
