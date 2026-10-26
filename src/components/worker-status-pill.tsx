import Link from "next/link";
import type { WorkerSnapshot } from "@/lib/worker-status";

const LABELS: Record<WorkerSnapshot["state"], string> = {
  running: "Worker running",
  stopped: "Worker stopped",
  offline: "Worker offline",
  unconfigured: "Worker not configured",
};

const DOT_CLASSES: Record<WorkerSnapshot["state"], string> = {
  running: "bg-emerald-500",
  stopped: "bg-amber-500",
  offline: "bg-rose-500",
  unconfigured: "bg-slate-400",
};

export function WorkerStatusPill({ snapshot }: { snapshot: WorkerSnapshot }) {
  return (
    <Link
      href="/video"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 no-underline shadow-sm transition hover:border-slate-300 hover:text-slate-900"
      title={snapshot.detail ?? "Open worker controls"}
    >
      <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[snapshot.state]}`} />
      {LABELS[snapshot.state]}
    </Link>
  );
}
