"use client";

import { useState } from "react";
import { buttonDanger, buttonPrimary, hintClass } from "@/components/ui";
import { formatStorageBytes } from "@/lib/storage-policy";

type Candidate = {
  id: string;
  filename: string;
  track: string | null;
  sizeBytes: number;
  createdAt: string;
  projectName: string | null;
  sessionTitle: string | null;
};
type Preview = {
  ok: boolean;
  days: number;
  cutoff: string;
  assetCount: number;
  bytes: number;
  byProject: { name: string; bytes: number; count: number }[];
  assets: Candidate[];
  error?: string;
};
type DeleteResult = {
  ok?: boolean;
  deleted?: number;
  skipped?: number;
  errors?: { id: string; error: string }[];
  error?: string;
};

export function RetentionCleanup({ retentionDays }: { retentionDays: number }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

  async function runPreview() {
    setBusy("preview");
    setMessage(null);
    try {
      const response = await fetch("/api/operations/storage/retention", { cache: "no-store" });
      const result = (await response.json()) as Preview;
      setPreview(result);
      if (!response.ok) setMessage(result.error ?? "Retention preview failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retention preview failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCandidates() {
    if (!preview || preview.assets.length === 0) return;
    if (confirmation !== "DELETE") {
      setMessage('Type DELETE to confirm.');
      return;
    }
    setBusy("delete");
    setMessage(null);
    try {
      const response = await fetch("/api/operations/storage/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds: preview.assets.map((asset) => asset.id),
          confirmation,
        }),
      });
      const result = (await response.json()) as DeleteResult;
      if (!response.ok) {
        setMessage(result.error ?? "Retention cleanup failed.");
        return;
      }
      const parts = [`Deleted ${result.deleted ?? 0} raw track(s).`];
      if (result.skipped) parts.push(`${result.skipped} skipped as no longer eligible.`);
      if (result.errors?.length) parts.push(`${result.errors.length} key(s) failed.`);
      setConfirmation("");
      await runPreview();
      setMessage(parts.join(" "));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retention cleanup failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className={hintClass}>
        Raw recording tracks older than {retentionDays} days that no timeline or storyboard references.
        Renders and uploaded evidence media are never touched.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonPrimary} disabled={busy !== null} onClick={() => void runPreview()}>
          {busy === "preview" ? "Checking..." : "Preview retention cleanup"}
        </button>
        {preview ? (
          <span className="text-xs text-slate-500">
            Window ends {new Date(preview.cutoff).toLocaleDateString()}
          </span>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {message}
        </p>
      ) : null}
      {preview ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidates</p>
              <p className="mt-1 font-medium text-slate-900">{preview.assetCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reclaimable</p>
              <p className="mt-1 font-medium text-slate-900">{formatStorageBytes(preview.bytes)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retention</p>
              <p className="mt-1 font-medium text-slate-900">{preview.days} days</p>
            </div>
          </div>
          {preview.assets.length === 0 ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              No eligible raw tracks. Nothing to clean up.
            </p>
          ) : (
            <>
              <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 font-medium">Session</th>
                      <th className="px-3 py-2 font-medium">Track</th>
                      <th className="px-3 py-2 font-medium">Recorded</th>
                      <th className="px-3 py-2 font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.assets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="max-w-[180px] truncate px-3 py-1.5" title={asset.projectName ?? "Unassigned"}>
                          {asset.projectName ?? "Unassigned"}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-1.5" title={asset.sessionTitle ?? "-"}>
                          {asset.sessionTitle ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">{asset.track ?? asset.filename}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">{formatStorageBytes(asset.sizeBytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <label className="text-sm text-rose-900" htmlFor="retention-confirmation">
                  Type DELETE to remove these {preview.assetCount} track(s)
                </label>
                <input
                  id="retention-confirmation"
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={buttonDanger}
                  disabled={busy !== null || confirmation !== "DELETE"}
                  onClick={() => void deleteCandidates()}
                >
                  {busy === "delete" ? "Deleting..." : "Delete eligible tracks"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
