import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, Card, CardHeader, PageHeader, SetupNotice, Stat, buttonPrimary, linkClass } from "@/components/ui";
import { getErrorIncidentCounts, listErrorIncidents } from "@/lib/queries";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "acknowledged", "investigating", "fixed", "verified", "archived", "wont_fix"] as const;
const SEVERITIES = ["info", "warning", "error", "critical"] as const;
const SOURCES = ["server", "client", "worker", "smoke", "manual"] as const;

const STATUS_TONES: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  new: "warning",
  acknowledged: "info",
  investigating: "info",
  fixed: "success",
  verified: "success",
  archived: "neutral",
  wont_fix: "neutral",
};

const SEVERITY_TONES: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  error: "danger",
  critical: "danger",
};

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; source?: string; q?: string; message?: string }>;
}) {
  const params = await searchParams;
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Incident ledger" />
        <SetupNotice title="Database required">Set DATABASE_URL and run pnpm db:migrate.</SetupNotice>
      </div>
    );
  }

  const [incidents, counts] = await Promise.all([
    listErrorIncidents({
      status: STATUSES.includes(params.status as (typeof STATUSES)[number]) ? params.status : undefined,
      severity: SEVERITIES.includes(params.severity as (typeof SEVERITIES)[number]) ? params.severity : undefined,
      source: SOURCES.includes(params.source as (typeof SOURCES)[number]) ? params.source : undefined,
      q: params.q?.trim() || undefined,
    }),
    getErrorIncidentCounts(),
  ]);
  const openCount = (counts.new ?? 0) + (counts.acknowledged ?? 0) + (counts.investigating ?? 0);
  const activeCritical = incidents.filter(
    (incident) => incident.severity === "critical" && !["archived", "wont_fix"].includes(incident.status),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident ledger"
        description="Self-reported failures grouped by fingerprint, with fix and verification history."
        actions={
          <Link href="/operations/errors/report" className={buttonPrimary}>
            Report a problem
          </Link>
        }
      />
      {params.message ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {params.message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open" value={openCount} hint="New, acknowledged, investigating" />
        <Stat label="Critical" value={activeCritical} />
        <Stat label="Verified" value={counts.verified ?? 0} />
        <Stat label="Archived" value={(counts.archived ?? 0) + (counts.wont_fix ?? 0)} />
      </div>

      <Card>
        <CardHeader title="Filter" description="Search title, message or route." />
        <form className="flex flex-wrap gap-2 p-5" method="get">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search incidents"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={params.status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Any status</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select name="severity" defaultValue={params.severity ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Any severity</option>
            {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
          </select>
          <select name="source" defaultValue={params.source ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Any source</option>
            {SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <button type="submit" className={buttonPrimary}>Apply</button>
          <Link href="/operations/errors" className={linkClass}>Clear</Link>
        </form>
      </Card>

      <Card>
        <CardHeader title={`${incidents.length} incident${incidents.length === 1 ? "" : "s"}`} />
        {incidents.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">No incidents match this filter.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <Link
                  href={`/operations/errors/${incident.id}`}
                  className="block px-5 py-4 no-underline transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{incident.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{incident.errorMessage}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {incident.route ?? "no route"} · {incident.source} · {incident.occurrenceCount} occurrence
                        {incident.occurrenceCount === 1 ? "" : "s"} · last {formatDateTime(incident.lastSeenAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge tone={SEVERITY_TONES[incident.severity] ?? "neutral"}>{incident.severity}</Badge>
                      <Badge tone={STATUS_TONES[incident.status] ?? "neutral"}>{incident.status}</Badge>
                      {incident.regressionCount > 0 ? <Badge tone="danger">regressed {incident.regressionCount}×</Badge> : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
