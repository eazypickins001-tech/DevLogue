"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadGhlAccounts,
  saveProjectAccounts,
  type AvailableAccount,
} from "@/app/actions/publishing";
import { buttonPrimary, buttonSecondary, hintClass, inputClass } from "@/components/ui";
import { PLATFORM_LABELS, type PlatformValue } from "@/lib/domain/content";

type SavedAccount = {
  externalAccountId: string;
  platform: string;
  displayName: string | null;
};

export function AccountPicker({
  projectId,
  saved,
  testMode,
}: {
  projectId: string;
  saved: SavedAccount[];
  testMode: boolean;
}) {
  const [available, setAvailable] = useState<AvailableAccount[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(saved.map((account) => account.externalAccountId)),
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const grouped = useMemo(() => {
    const filtered = (available ?? []).filter((account) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return (
        account.name.toLowerCase().includes(needle) ||
        account.platform.toLowerCase().includes(needle)
      );
    });
    const map = new Map<string, AvailableAccount[]>();
    for (const account of filtered) {
      const list = map.get(account.platform) ?? [];
      list.push(account);
      map.set(account.platform, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [available, query]);

  function toggle(account: AvailableAccount) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(account.id)) next.delete(account.id);
      else next.add(account.id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <p className={hintClass}>
        {testMode
          ? "Test mode is ON: posts are created as HighLevel drafts and never published."
          : "Test mode is OFF: scheduled posts will publish at the chosen time."}
      </p>
      <p className="text-sm text-slate-600">
        {saved.length} account(s) saved for this project.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonSecondary}
          disabled={pending}
          onClick={() => {
            setError(null);
            setStatus("Loading accounts…");
            startTransition(async () => {
              const result = await loadGhlAccounts();
              if (!result.ok) {
                setStatus(null);
                setError(result.error);
                return;
              }
              setAvailable(result.accounts);
              setStatus(`${result.accounts.length} accounts loaded.`);
            });
          }}
        >
          Load accounts from HighLevel
        </button>
        {available ? (
          <button
            type="button"
            className={buttonPrimary}
            disabled={pending}
            onClick={() => {
              setError(null);
              const chosen = available.filter((account) => selected.has(account.id));
              startTransition(async () => {
                const result = await saveProjectAccounts({
                  projectId,
                  accounts: chosen.map((account) => ({
                    id: account.id,
                    name: account.name,
                    platform: account.platform,
                    type: account.type ?? null,
                  })),
                });
                if (!result.ok) {
                  setError(result.error ?? "Could not save accounts.");
                  return;
                }
                setStatus(`${chosen.length} account(s) saved.`);
                router.refresh();
              });
            }}
          >
            {pending ? "Saving…" : `Save ${selected.size} selected`}
          </button>
        ) : null}
      </div>

      {available ? (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or platform"
            className={inputClass}
          />
          <div className="max-h-80 space-y-3 overflow-auto rounded-lg border border-slate-200 p-3">
            {grouped.length === 0 ? (
              <p className="text-sm text-slate-600">No accounts match this filter.</p>
            ) : (
              grouped.map(([platform, accounts]) => (
                <div key={platform}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {PLATFORM_LABELS[platform as PlatformValue] ?? platform} ({accounts.length})
                  </p>
                  <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                    {accounts.map((account) => (
                      <li key={account.id}>
                        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selected.has(account.id)}
                            onChange={() => toggle(account)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="truncate text-slate-800">{account.name}</span>
                          {account.type ? (
                            <span className="ml-auto text-[10px] uppercase text-slate-400">
                              {account.type}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}

      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
