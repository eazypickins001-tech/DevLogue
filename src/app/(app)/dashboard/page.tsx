import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, Card, CardHeader, EmptyState, FormMessage, PageHeader, SetupNotice, Stat, buttonPrimary, linkClass, mutedLinkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { getDashboardData, getErrorIncidentCounts } from "@/lib/queries";
import { DRAFT_STATUS_LABELS, SESSION_STATUS_LABELS, formatDate, formatDateTime } from "@/lib/labels";
import { CONTENT_FORMATS, type ContentFormatValue } from "@/lib/domain/content";
import { getWorkerSnapshot } from "@/lib/worker-status";
import { WorkerStatusPill } from "@/components/worker-status-pill";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Your daily build-in-public workflow." />
        <SetupNotice title="DevLogue needs a database before it can show your work">
          <p>
            Add a Neon Postgres <code className="font-mono">DATABASE_URL</code> to{" "}
            <code className="font-mono">.env.local</code>, then run{" "}
            <code className="font-mono">pnpm db:migrate</code>.
          </p>
          <p>
            <Link className={linkClass} href="/integrations">
              See all integration requirements →
            </Link>
          </p>
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [data, worker, incidentCounts] = await Promise.all([
    getDashboardData(owner.id),
    getWorkerSnapshot(),
    getErrorIncidentCounts(),
  ]);
  const openIncidents =
    (incidentCounts.new ?? 0) + (incidentCounts.acknowledged ?? 0) + (incidentCounts.investigating ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="What you built, what is ready, what needs review, what is scheduled, and what is next."
        actions={
          <>
            <WorkerStatusPill snapshot={worker} />
            <Link href="/sessions/new" className={buttonPrimary}>
              Capture session
            </Link>
            <Link href="/projects/new" className={buttonPrimary}>
              New project
            </Link>
          </>
        }
      />
      <FormMessage message={message} tone="success" />

      {openIncidents > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            <strong>{openIncidents} open incident{openIncidents === 1 ? "" : "s"}</strong> need attention.
          </p>
          <Link className="font-medium underline" href="/operations/errors">
            Open incident ledger
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Projects" value={data.counts.projectCount} />
        <Stat label="Sessions" value={data.counts.sessionCount} />
        <Stat label="Drafts" value={data.counts.draftCount} />
        <Stat label="Needs review" value={data.counts.reviewCount} hint="Drafts + edits" />
        <Stat label="Approved" value={data.counts.approvedCount} />
        <Stat label="Published" value={data.counts.publishedCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recently built"
            description="Latest documented sessions."
            action={
              <Link className={mutedLinkClass} href="/sessions">
                All sessions
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            {data.recentSessions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No sessions yet"
                  description="Document your next development session so content can be generated from real evidence."
                  action={
                    <Link href="/sessions/new" className={buttonPrimary}>
                      Capture your first session
                    </Link>
                  }
                />
              </div>
            ) : (
              data.recentSessions.map(({ session, projectName }) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block px-5 py-3 no-underline transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-900">{session.title}</p>
                    <Badge tone={session.status === "drafted" ? "success" : "neutral"}>
                      {SESSION_STATUS_LABELS[session.status] ?? session.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {projectName} · {formatDate(session.createdAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Needs your review"
            description="AI drafts and edits waiting for approval."
            action={
              <Link className={mutedLinkClass} href="/studio">
                Content studio
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            {data.reviewDrafts.length === 0 ? (
              <div className="p-5 text-sm text-slate-600">
                Nothing waiting. Generate drafts from an analyzed session.
              </div>
            ) : (
              data.reviewDrafts.map(({ draft, projectName }) => (
                <Link
                  key={draft.id}
                  href={`/studio/${draft.id}`}
                  className="block px-5 py-3 no-underline transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {draft.title || CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                    </p>
                    <Badge tone="warning">{DRAFT_STATUS_LABELS[draft.status] ?? draft.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {projectName} · v{draft.currentVersion} · {formatDate(draft.updatedAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Scheduled"
            description="Posts queued for publishing."
            action={
              <Link className={mutedLinkClass} href="/calendar">
                Calendar
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            {data.upcoming.length === 0 ? (
              <div className="p-5 text-sm text-slate-600">
                No scheduled posts. Scheduling through GoHighLevel is wired in phase 4; approved
                drafts are listed in the calendar for handoff.
              </div>
            ) : (
              data.upcoming.map(({ post, projectName }) => (
                <div key={post.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">{projectName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(post.scheduledAt)} · {post.status} · {post.provider}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Next up"
            description="The next task from your most recent session."
          />
          <div className="space-y-3 p-5">
            {data.recentSessions[0]?.session.nextTask ? (
              <p className="text-sm text-slate-800">{data.recentSessions[0].session.nextTask}</p>
            ) : (
              <p className="text-sm text-slate-600">
                No next task recorded. Add one when you capture your next session.
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{data.counts.feedbackCount} feedback item(s)</span>
              <span>
                AI calls: {data.usage.calls} · tokens in/out: {data.usage.totalTokensIn}/
                {data.usage.totalTokensOut}
              </span>
              <span>
                Reported cost: {data.usage.totalCost ? `$${Number(data.usage.totalCost).toFixed(4)}` : "not reported"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
