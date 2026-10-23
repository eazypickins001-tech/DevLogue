"use client";

import { useState, useTransition } from "react";
import { runConnectionChecks, type CheckResult } from "@/app/actions/integrations";
import { buttonSecondary } from "@/components/ui";

export function IntegrationChecks() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={buttonSecondary}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              setResults(await runConnectionChecks());
            } catch (checkError) {
              setError(checkError instanceof Error ? checkError.message : "Check failed.");
            }
          });
        }}
      >
        {pending ? "Running checks…" : "Run connection checks"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {results ? (
        <ul className="space-y-2">
          {results.map((result) => (
            <li key={result.key} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{result.label}</span>
                <span className={result.ok ? "text-emerald-700" : "text-rose-700"}>
                  {result.ok ? "OK" : "Needs attention"}
                </span>
              </div>
              <p className="mt-1 text-slate-600">{result.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
