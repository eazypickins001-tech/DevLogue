import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, PageHeader, SetupNotice, linkClass } from "@/components/ui";
import { getOwner, requireSession } from "@/lib/auth";
import { listTimelines } from "@/lib/queries";
import { formatDate } from "@/lib/labels";
import { formatDuration } from "@/lib/recording/types";

export const dynamic = "force-dynamic";

export default async function TimelinesPage() {
  await requireSession();

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Timelines" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const rows = await listTimelines(owner.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timelines"
        description="Recordings become editable multi-track timelines. Camera overlay visibility and 16:9/9:16 framing stay editable."
        actions={
          <Link className={linkClass} href="/record">
            Record a session
          </Link>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <h2 className="text-sm font-semibold text-slate-800">No timelines yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Record a session and save it to create your first timeline.
          </p>
          <Link className={`${linkClass} mt-3 inline-block`} href="/record">
            Open recorder
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {rows.map(({ timeline, projectName, sessionTitle, clipCount }) => (
              <li key={timeline.id}>
                <Link
                  href={`/timelines/${timeline.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 no-underline transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{timeline.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {projectName}
                      {sessionTitle ? ` - ${sessionTitle}` : ""} - {formatDuration(Number(timeline.durationSeconds))} -{" "}
                      {clipCount} clip{clipCount === 1 ? "" : "s"} - {formatDate(timeline.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{timeline.aspectRatio}</Badge>
                    <Badge tone={timeline.status === "draft" ? "warning" : "success"}>
                      {timeline.status}
                    </Badge>
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
