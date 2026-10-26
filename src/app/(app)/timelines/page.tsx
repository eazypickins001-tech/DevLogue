import Image from "next/image";
import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, PageHeader, SetupNotice, linkClass } from "@/components/ui";
import { getOwner, requireSession } from "@/lib/auth";
import { getWorkerSnapshot } from "@/lib/worker-status";
import { WorkerStatusPill } from "@/components/worker-status-pill";
import { listTimelines } from "@/lib/queries";
import { formatDate } from "@/lib/labels";
import { formatDuration } from "@/lib/recording/types";

export const dynamic = "force-dynamic";

export default async function TimelinesPage() {
  await requireSession();

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Video Editor" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [rows, worker] = await Promise.all([listTimelines(owner.id), getWorkerSnapshot()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Editor"
        description="Recordings become editable multi-track timelines. Camera overlay visibility and 16:9/9:16 framing stay editable."
        actions={
          <>
            <WorkerStatusPill snapshot={worker} />
            <Link className={linkClass} href="/record">
              Record a session
            </Link>
          </>
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
            {rows.map(
              ({ timeline, projectName, sessionTitle, clipCount, renderMediaId, renderThumbnailKey }) => (
                <li key={timeline.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <Link
                    href={`/timelines/${timeline.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 no-underline transition hover:opacity-80"
                  >
                    <div className="relative grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
                      {renderMediaId && renderThumbnailKey ? (
                        <Image
                          src={`/api/media/${renderMediaId}/thumbnail`}
                          alt=""
                          width={112}
                          height={64}
                          unoptimized
                          className="h-16 w-28 object-cover"
                        />
                      ) : (
                        <span className="px-2 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          No preview
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{timeline.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {projectName}
                        {sessionTitle ? ` - ${sessionTitle}` : ""} - {formatDuration(Number(timeline.durationSeconds))} -{" "}
                        {clipCount} clip{clipCount === 1 ? "" : "s"} - {formatDate(timeline.updatedAt)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{timeline.aspectRatio}</Badge>
                    <Badge tone={timeline.status === "draft" ? "warning" : "success"}>
                      {timeline.status}
                    </Badge>
                  </div>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
