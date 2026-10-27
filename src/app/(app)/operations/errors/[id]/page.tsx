import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import {
  Badge,
  Card,
  CardHeader,
  FormMessage,
  PageHeader,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  labelClass,
  linkClass,
  selectClass,
  textareaClass,
} from "@/components/ui";
import { updateIncident } from "@/app/actions/errors";
import { getErrorIncidentDetail } from "@/lib/queries";
import { buildIncidentBrief } from "@/lib/errors/brief";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "acknowledged", "investigating", "fixed", "verified", "archived", "wont_fix"] as const;
const SEVERITIES = ["info", "warning", "error", "critical"] as const;

export default async function IncidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  const { message, error } = await searchParams;
  const detail = await getErrorIncidentDetail(id);
  if (!detail) notFound();
  const { incident, events, notes } = detail;
  const brief = buildIncidentBrief(incident, events, notes);
  const latest = events[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={incident.title}
        description={`${incident.source} · ${incident.environment ?? "unknown environment"} · first seen ${formatDateTime(incident.firstSeenAt)}`}
        actions={
          <>
            <Link className={linkClass} href="/operations/errors">All incidents</Link>
            <Link className={linkClass} href={`/operations/errors/${incident.id}/brief?format=json`} target="_blank">JSON</Link>
            <Link className={linkClass} href={`/operations/errors/${incident.id}/brief`} target="_blank">Markdown</Link>
            <CopyButton text={brief} label="Copy AI brief" />
          </>
        }
      />
      <FormMessage message={error} />
      <FormMessage message={message} tone="success" />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={incident.severity === "critical" || incident.severity === "error" ? "danger" : "warning"}>
          {incident.severity}
        </Badge>
        <Badge tone={incident.status === "verified" ? "success" : incident.status === "archived" ? "neutral" : "info"}>
          {incident.status}
        </Badge>
        <Badge tone="neutral">{incident.source}</Badge>
        <span className="text-xs text-slate-500">
          {incident.occurrenceCount} occurrence{incident.occurrenceCount === 1 ? "" : "s"} · last seen {formatDateTime(incident.lastSeenAt)}
        </span>
        {incident.regressionCount > 0 ? <Badge tone="danger">regressed {incident.regressionCount}×</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Failure" />
            <div className="space-y-3 p-5 text-sm">
              <p className="rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
                {incident.errorName ?? "Error"}: {incident.errorMessage}
              </p>
              <p><span className="font-medium text-slate-900">Route:</span> {incident.route ?? "—"}</p>
              <p><span className="font-medium text-slate-900">Action:</span> {incident.action ?? "—"}</p>
              <p><span className="font-medium text-slate-900">Top frame:</span> {incident.topFrame ?? "not captured"}</p>
              <p><span className="font-medium text-slate-900">Cause:</span> {incident.cause ?? "not captured"}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Context" description="Redacted before storage." />
            <pre className="max-h-80 overflow-auto p-5 text-xs leading-5 text-slate-700">
              {JSON.stringify(incident.context ?? {}, null, 2)}
            </pre>
          </Card>

          <Card>
            <CardHeader title="Recent occurrences" description={`${events.length} event${events.length === 1 ? "" : "s"} shown`} />
            {events.length === 0 ? (
              <p className="p-5 text-sm text-slate-600">No events recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((event) => (
                  <li key={event.id} className="space-y-2 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{event.errorName ?? "Error"}: {event.message}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(event.occurredAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {event.source} · {event.route ?? "no route"} · request {event.requestId ?? "—"}
                      {event.jobType ? ` · job ${event.jobType}/${event.jobId ?? "—"}` : ""}
                    </p>
                    {event.stack ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-slate-500">Stack</summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{event.stack}</pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Audit trail" />
            {notes.length === 0 ? (
              <p className="p-5 text-sm text-slate-600">No notes yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notes.map((note) => (
                  <li key={note.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{note.action}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(note.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{note.actor}</p>
                    {note.note ? <p className="mt-1 text-slate-700">{note.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Update incident" description="Fixed requires a commit; verified requires evidence." />
            <form action={updateIncident} className="space-y-3 p-5">
              <input type="hidden" name="incidentId" value={incident.id} />
              <div>
                <label className={labelClass} htmlFor="title">Title</label>
                <input id="title" name="title" defaultValue={incident.title} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} htmlFor="status">Status</label>
                  <select id="status" name="status" defaultValue={incident.status} className={selectClass}>
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="severity">Severity</label>
                  <select id="severity" name="severity" defaultValue={incident.severity} className={selectClass}>
                    {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="fixCommit">Fix commit</label>
                <input id="fixCommit" name="fixCommit" defaultValue={incident.fixCommit ?? ""} className={inputClass} placeholder="abc1234" />
              </div>
              <div>
                <label className={labelClass} htmlFor="resolutionSummary">Resolution summary</label>
                <textarea id="resolutionSummary" name="resolutionSummary" defaultValue={incident.resolutionSummary ?? ""} rows={3} className={textareaClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="verificationMethod">Verification method</label>
                <input id="verificationMethod" name="verificationMethod" defaultValue={incident.verificationMethod ?? ""} className={inputClass} placeholder="smoke test / unit test / manual production check" />
              </div>
              <div>
                <label className={labelClass} htmlFor="verificationNotes">Verification notes</label>
                <textarea id="verificationNotes" name="verificationNotes" defaultValue={incident.verificationNotes ?? ""} rows={3} className={textareaClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="note">Add note</label>
                <textarea id="note" name="note" rows={2} className={textareaClass} placeholder="What changed or what did you learn?" />
              </div>
              <button type="submit" className={buttonPrimary}>Save incident</button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Related records" />
            <div className="space-y-2 p-5 text-sm text-slate-700">
              <p>Project: {latest?.projectId ?? "—"}</p>
              <p>Session: {latest?.sessionId ?? "—"}</p>
              <p>Timeline: {latest?.timelineId ?? "—"}</p>
              <p>Media: {latest?.mediaId ?? "—"}</p>
              <p>Job: {latest?.jobType ?? "—"} / {latest?.jobId ?? "—"}</p>
              <Link className={linkClass} href="/operations/errors/report">Report another problem</Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="AI debug bundle" description="Markdown is generated from the record and latest event." />
            <div className="flex flex-wrap gap-2 p-5">
              <CopyButton text={brief} label="Copy brief" />
              <Link className={buttonSecondary} href={`/operations/errors/${incident.id}/brief`} target="_blank">Open Markdown</Link>
              <Link className={buttonSecondary} href={`/operations/errors/${incident.id}/brief?format=json`} target="_blank">Open JSON</Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
