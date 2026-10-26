import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  SetupNotice,
  buttonSecondary,
  linkClass,
} from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listDrafts, listTimelines } from "@/lib/queries";
import { DRAFT_STATUS_LABELS, truncate, formatDate } from "@/lib/labels";
import { CONTENT_FORMATS, CONTENT_FORMAT_VALUES, type ContentFormatValue } from "@/lib/domain/content";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "needs_review", "approved", "archived"] as const;

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; format?: string; message?: string }>;
}) {
  const { status, format, message } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Studio" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [rows, timelines] = await Promise.all([
    listDrafts(owner.id, { status, format }),
    listTimelines(owner.id),
  ]);
  const activeStatus = STATUSES.includes(status as (typeof STATUSES)[number]) ? status : undefined;
  const activeFormat = CONTENT_FORMAT_VALUES.includes(format as ContentFormatValue)
    ? format
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio"
        description="Drafts and video timelines in one place. AI output, your edits and the approved version stay separate."
      />
      <Card>
        <CardHeader
          title="Video timelines"
          description="Recordings and edits. Render a timeline, then create a short-video draft."
          action={
            <Link className={linkClass} href="/timelines">
              All timelines
            </Link>
          }
        />
        {timelines.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-slate-600">
            <p>No video timelines yet. Record a session to create one.</p>
            <Link className={buttonSecondary} href="/record">
              Record a session
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {timelines.map(({ timeline, projectName, sessionTitle, clipCount }) => (
              <li key={timeline.id}>
                <Link
                  href={`/timelines/${timeline.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 no-underline transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{timeline.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {projectName}
                      {sessionTitle ? ` - ${sessionTitle}` : ""} - {timeline.aspectRatio} - {clipCount} clip
                      {clipCount === 1 ? "" : "s"} - {formatDate(timeline.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        timeline.status === "rendered"
                          ? "success"
                          : timeline.status === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {timeline.status}
                    </Badge>
                    <span className={linkClass}>Open editor</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {message ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <Link
            href={`/studio${activeFormat ? `?format=${activeFormat}` : ""}`}
            className={`rounded-full px-3 py-1 no-underline ${
              !activeStatus ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            All
          </Link>
          {STATUSES.map((item) => (
            <Link
              key={item}
              href={`/studio?status=${item}${activeFormat ? `&format=${activeFormat}` : ""}`}
              className={`rounded-full px-3 py-1 no-underline ${
                activeStatus === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {DRAFT_STATUS_LABELS[item]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Format</span>
          <Link
            href={`/studio${activeStatus ? `?status=${activeStatus}` : ""}`}
            className={`rounded-full px-3 py-1 no-underline ${
              !activeFormat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            All
          </Link>
          {CONTENT_FORMAT_VALUES.map((item) => (
            <Link
              key={item}
              href={`/studio?format=${item}${activeStatus ? `&status=${activeStatus}` : ""}`}
              className={`rounded-full px-3 py-1 no-underline ${
                activeFormat === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {CONTENT_FORMATS[item].label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <h2 className="text-sm font-semibold text-slate-800">No drafts match this filter</h2>
          <p className="mt-1 text-sm text-slate-600">
            Text drafts come from an analyzed{" "}
            <Link className={linkClass} href="/sessions">
              build session
            </Link>
            . Video drafts come from a rendered{" "}
            <Link className={linkClass} href="/timelines">
              timeline
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {rows.map(({ draft, projectName, sessionTitle }) => (
              <li key={draft.id}>
                <Link
                  href={`/studio/${draft.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 no-underline transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {draft.title || CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {projectName}
                      {sessionTitle ? ` · ${sessionTitle}` : ""} · v{draft.currentVersion} ·{" "}
                      {formatDate(draft.updatedAt)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{truncate(draft.body, 180)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={draft.status === "approved" ? "success" : draft.status === "archived" ? "neutral" : "warning"}>
                      {DRAFT_STATUS_LABELS[draft.status] ?? draft.status}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
