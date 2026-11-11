import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SetupNotice,
  buttonPrimary,
  linkClass,
} from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listApprovedDrafts, listDrafts, listScheduledPosts } from "@/lib/queries";
import { formatDateTime } from "@/lib/labels";
import { CONTENT_FORMATS, type ContentFormatValue } from "@/lib/domain/content";
import { getServiceStatuses } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Publishing Calendar" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [posts, approved, pending] = await Promise.all([
    listScheduledPosts(owner.id),
    listApprovedDrafts(owner.id),
    listDrafts(owner.id, { status: "needs_review" }),
  ]);
  const ghl = getServiceStatuses().find((service) => service.key === "ghl");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publishing Calendar"
        description="Approved content, scheduled posts and publishing handoff."
      />

      {!ghl?.configured ? (
        <SetupNotice title="GoHighLevel is not connected">
          <p>
            Add <code className="font-mono">GHL_API_TOKEN</code>,{" "}
            <code className="font-mono">GHL_LOCATION_ID</code> and{" "}
            <code className="font-mono">GHL_USER_ID</code>. The adapter uses the verified Social
            Planner endpoint ({`POST /social-media-posting/{locationId}/posts`},{" "}
            <code className="font-mono">Version: 2021-07-28</code>) with draft and scheduled statuses.
          </p>
          <p>
            Scheduling is deliberately disabled until credentials and account IDs are confirmed. You
            can still hand off approved captions manually.
          </p>
        </SetupNotice>
      ) : null}

      <Card>
        <CardHeader
          title="Waiting for approval"
          description="Rendered timelines and AI drafts land here first. Approve a draft to move it into publishing."
        />
        {pending.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">Nothing is waiting for approval.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.slice(0, 8).map(({ draft, projectName }) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <Link
                    href={`/studio/${draft.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {draft.title || CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {projectName} ·{" "}
                    {CONTENT_FORMATS[draft.format as ContentFormatValue]?.label ?? draft.format}
                  </p>
                </div>
                <Badge tone="warning">Needs review</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Scheduled and published" description="Status comes from the provider only when a job runs." />
          {posts.length === 0 ? (
            <div className="p-5">
              {approved.length > 0 ? (
                <EmptyState
                  title="Nothing scheduled yet"
                  description={`${approved.length} approved draft${approved.length === 1 ? "" : "s"} ready for handoff. Open one to create a HighLevel draft or schedule it.`}
                  action={
                    <Link
                      className={buttonPrimary}
                      href={`/studio/${approved[0].draft.id}#publishing`}
                    >
                      Open approved draft
                    </Link>
                  }
                />
              ) : (
                <EmptyState
                  title="Nothing scheduled"
                  description={
                    pending.length > 0
                      ? `${pending.length} draft${pending.length === 1 ? "" : "s"} waiting for approval above. Approve one to move it here.`
                      : ghl?.configured
                        ? "Approve a draft in Studio, then create a HighLevel draft or schedule it."
                        : "Approve a draft in Studio. Scheduling is enabled when GHL credentials are configured."
                  }
                  action={
                    <Link className={linkClass} href="/studio">
                      Open Studio
                    </Link>
                  }
                />
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {posts.map(({ post, projectName, draftTitle, draftFormat }) => (
                <li key={post.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {draftTitle || CONTENT_FORMATS[draftFormat as ContentFormatValue]?.label}
                    </p>
                    <Badge
                      tone={
                        post.status === "published"
                          ? "success"
                          : post.status === "failed"
                            ? "danger"
                            : "info"
                      }
                    >
                      {post.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {projectName} · {formatDateTime(post.scheduledAt)} · {post.timezone} · {post.provider}
                  </p>
                  {post.error ? <p className="mt-1 text-xs text-rose-700">{post.error}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="approved">
          <CardHeader
            title="Ready for handoff"
            description="Approved drafts. Open one to create a HighLevel draft or schedule it."
          />
          {approved.length === 0 ? (
            <div className="p-5 text-sm text-slate-600">
              Nothing approved yet. Approve a draft in the{" "}
              <Link className={linkClass} href="/studio">
                Content Studio
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {approved.map(({ draft, projectName }) => (
                <li key={draft.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/studio/${draft.id}`} className="text-sm font-medium text-slate-900">
                      {draft.title || CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                    </Link>
                    <div className="flex items-center gap-3">
                      <Badge tone="success">Approved v{draft.approvedVersion}</Badge>
                      <Link className={linkClass} href={`/studio/${draft.id}#publishing`}>
                        Publishing handoff
                      </Link>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {projectName} · {CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                  </p>
                  <pre className="prose-draft mt-2 max-h-28 overflow-auto rounded-lg bg-slate-50 p-2 font-sans text-xs">
                    {draft.body}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
