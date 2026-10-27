"use client";

import { useState } from "react";
import { buttonDanger, buttonPrimary, hintClass } from "@/components/ui";

type OrphanObject = { key: string; size: number; lastModified: string | null };
type ScanResult = {
  ok: boolean;
  scannedAt: string;
  objectCount: number;
  objectBytes: number;
  knownCount: number;
  orphanCount: number;
  orphanBytes: number;
  orphans: OrphanObject[];
  truncated: boolean;
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

export function StorageAudit() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState<"scan" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runScan() {
    setBusy("scan");
    setMessage(null);
    try {
      const response = await fetch("/api/operations/storage/orphans", { cache: "no-store" });
      const result = (await response.json()) as ScanResult;
      setScan(result);
      if (!response.ok) setMessage(result.error ?? "Storage scan failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Storage scan failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteOrphans() {
    if (!scan || scan.orphans.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${scan.orphanCount} orphan object${scan.orphanCount === 1 ? "" : "s"} from R2? This cannot be undone. Known database assets are rechecked before deletion.`,
    );
    if (!confirmed) return;
    setBusy("delete");
    setMessage(null);
    try {
      const response = await fetch("/api/operations/storage/orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: scan.orphans.map((object) => object.key) }),
      });
      const result = (await response.json()) as { ok?: boolean; deleted?: number; errors?: { key: string; error: string }[]; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Orphan deletion failed.");
        return;
      }
      const deletionMessage = `Deleted ${result.deleted ?? 0} orphan object(s)${result.errors?.length ? `; ${result.errors.length} failed` : ""}.`;
      await runScan();
      setMessage(deletionMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Orphan deletion failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonPrimary} disabled={busy !== null} onClick={() => void runScan()}>
          {busy === "scan" ? "Scanning R2..." : "Scan R2 for orphans"}
        </button>
        {scan && scan.orphans.length > 0 ? (
          <button type="button" className={buttonDanger} disabled={busy !== null} onClick={() => void deleteOrphans()}>
            {busy === "delete" ? "Deleting..." : `Delete ${scan.orphanCount} orphan${scan.orphanCount === 1 ? "" : "s"}`}
          </button>
        ) : null}
        {scan ? <span className="text-xs text-slate-500">Scanned {new Date(scan.scannedAt).toLocaleString()}</span> : null}
      </div>
      {message ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}
      {scan ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">R2 objects</p>
              <p className="mt-1 font-medium text-slate-900">{scan.objectCount}</p>
              <p className="text-xs text-slate-500">{formatBytes(scan.objectBytes)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Database keys</p>
              <p className="mt-1 font-medium text-slate-900">{scan.knownCount}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Orphans</p>
              <p className="mt-1 font-medium text-amber-900">{scan.orphanCount}</p>
              <p className="text-xs text-amber-700">{formatBytes(scan.orphanBytes)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage</p>
              <p className="mt-1 font-medium text-slate-900">media/ - renders/ - derivatives/</p>
            </div>
          </div>
          {scan.truncated ? <p className={hintClass}>Showing the first 1,000 orphan keys. Delete and rescan to continue.</p> : null}
          {scan.orphans.length === 0 ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              No orphaned objects found in the audited prefixes.
            </p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Key</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Last modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {scan.orphans.map((object) => (
                    <tr key={object.key}>
                      <td className="max-w-[420px] truncate px-3 py-1.5" title={object.key}>{object.key}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">{formatBytes(object.size)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{object.lastModified ? new Date(object.lastModified).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className={hintClass}>
          Dry-run first. Deletion rechecks the database and only removes keys under the audited prefixes.
        </p>
      )}
    </div>
  );
}
