import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, EmptyState, PageHeader, SetupNotice, buttonPrimary, linkClass, mutedLinkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listSessions } from "@/lib/queries";
import { SESSION_STATUS_LABELS, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; message?: string }>;
}) {
  const { projectId, message } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Build Sessions" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const rows = await listSessions(owner.id, projectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build Sessions"
        description="The raw material: what you built, what broke, what you learned."
        actions={
          <Link href="/sessions/new" className={buttonPrimary}>
            Capture session
          </Link>
        }
      />
      {message ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {projectId ? (
        <p className="text-sm text-slate-600">
          Filtered by project.{" "}
          <Link className={linkClass} href="/sessions">
            Clear filter
          </Link>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No build sessions yet"
          description="A session takes a few minutes to document and is the evidence for every piece of content."
          action={
            <Link href="/sessions/new" className={buttonPrimary}>
              Capture your first session
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {rows.map(({ session, projectName, evidenceCount, draftCount }) => (
              <li key={session.id}>
                <Link
                  href={`/sessions/${session.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 no-underline transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{session.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {projectName} · {formatDate(session.createdAt)} · {evidenceCount} evidence ·{" "}
                      {draftCount} draft(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.publishable ? <Badge tone="success">Publishable</Badge> : <Badge tone="warning">Review privacy</Badge>}
                    <Badge tone={session.status === "drafted" ? "success" : "neutral"}>
                      {SESSION_STATUS_LABELS[session.status] ?? session.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500">
        <Link className={mutedLinkClass} href="/projects">
          Manage projects
        </Link>
      </p>
    </div>
  );
}
