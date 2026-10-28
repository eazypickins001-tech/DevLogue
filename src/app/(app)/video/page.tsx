import Image from "next/image";
import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader, SetupNotice, buttonSecondary, linkClass } from "@/components/ui";
import { createTimelineDraft } from "@/app/actions/recordings";
import { retryFailedJobs } from "@/app/actions/worker";
import { getOwner } from "@/lib/auth";
import {
  getWorkerQueueSummary,
  listRenderJobsForUser,
  listStoryboardDrafts,
  listTimelines,
} from "@/lib/queries";
import { WorkerControl } from "@/components/worker-control";
import { getWorkerLogTail } from "@/lib/worker-status";
import { formatDate, formatDateTime } from "@/lib/labels";
import { formatDuration } from "@/lib/recording/types";

export const dynamic = "force-dynamic";

export default async function VideoPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { message, error } = await searchParams;
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Video Production" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [boards, jobs, queue, timelines, workerLog] = await Promise.all([
    listStoryboardDrafts(owner.id),
    listRenderJobsForUser(owner.id),
    getWorkerQueueSummary(),
    listTimelines(owner.id),
    getWorkerLogTail(),
  ]);
  const renderedTimelines = timelines.filter((row) => row.renderMediaId);
  const failedCount = Object.values(queue).reduce((total, counts) => total + (counts.failed ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Production"
        description="Storyboards are ready to edit. Automated rendering is a local-worker feature, not a Vercel request."
      />

      {message ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <SetupNotice title="Rendering runs on your machine">
        <p>
          Queue a render from a storyboard, then run the worker. It trims and loops clips, scales to
          1080Ã—1920, burns captions, adds an audio track, validates with ffprobe and uploads to R2.
        </p>
        <p className="font-mono text-xs">pnpm worker Â· pnpm worker:once Â· ffmpeg 9.0.2 Â· faster-whisper base.en</p>
        <p>
          Whisper transcribes uploaded video/audio once per asset and stores the segments; missing
          tools are skipped, not faked.
        </p>
      </SetupNotice>

      <Card>
        <CardHeader
          title="Worker control"
          description="Start or stop the local/Contabo render, transcription and preview worker."
        />
        <div className="p-5">
          <WorkerControl />
          <p className="mt-3 text-xs text-slate-500">
            The worker stays running and polls for jobs. 0 queued means it is idle; stop it when you
            want to free the server.
          </p>
        </div>
      </Card>

      <Card>
        <details className="group">
          <summary className="cursor-pointer list-none px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Recent worker log</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Open to inspect the latest startup, render and failure lines.
                </p>
              </div>
              <span className="text-xs text-slate-500 group-open:hidden">Show</span>
              <span className="hidden text-xs text-slate-500 group-open:inline">Hide</span>
            </div>
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-slate-100 bg-slate-950 p-4 text-xs leading-5 text-slate-200">
            {workerLog}
          </pre>
        </details>
      </Card>

      <Card>
        <CardHeader
          title="Queue"
          description="Queued and running work across previews, transcription and rendering."
          action={
            failedCount > 0 ? (
              <form action={retryFailedJobs}>
                <button type="submit" className={buttonSecondary}>
                  Retry {failedCount} failed job{failedCount === 1 ? "" : "s"}
                </button>
              </form>
            ) : undefined
          }
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Previews", counts: queue.derivatives },
            { label: "Transcription", counts: queue.transcription },
            { label: "Timelines", counts: queue.timelines },
            { label: "Storyboards", counts: queue.storyboards },
          ].map(({ label, counts }) => (
            <div key={label} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-sm text-slate-700">
                {counts.queued ?? 0} queued · {counts.running ?? 0} running
              </p>
              {counts.failed ? (
                <p className="text-xs text-rose-700">{counts.failed} failed</p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Timeline outputs"
          description="Rendered videos and their worker-generated previews. Open one to edit, or create its Studio draft."
          action={
            <Link className={linkClass} href="/timelines">
              All timelines
            </Link>
          }
        />
        {renderedTimelines.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">
            No rendered timelines yet. Open the Video Editor, queue a render, then let the worker
            finish.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {renderedTimelines.slice(0, 6).map(
              ({ timeline, projectName, renderMediaId, renderThumbnailKey }) => (
                <li key={timeline.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
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
                          Preview queued
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{timeline.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {projectName} - {formatDuration(Number(timeline.durationSeconds))} -{" "}
                        {formatDate(timeline.updatedAt)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="success">rendered</Badge>
                    {timeline.draftId ? (
                      <Link className={buttonSecondary} href={`/studio/${timeline.draftId}`}>
                        Open draft
                      </Link>
                    ) : (
                      <form action={createTimelineDraft}>
                        <input type="hidden" name="timelineId" value={timeline.id} />
                        <button type="submit" className={buttonSecondary}>
                          Create draft
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Storyboards"
          description={`${boards.length} short-form storyboard(s) generated from real sessions.`}
        />
        {boards.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No storyboards yet"
              description="Generate a short-video format from an analyzed session. Scenes reference uploaded screenshots or recordings."
              action={
                <Link className={linkClass} href="/sessions">
                  Open build sessions
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {boards.map(({ draft, board, projectName, sceneCount, linkedScenes }) => (
              <li key={board.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/studio/${draft.id}`} className="text-sm font-medium text-slate-900">
                      {board.hook || draft.title || "Short video"}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {projectName} Â· {formatDate(board.createdAt)} Â· {sceneCount} scenes Â·{" "}
                      {linkedScenes} linked to media Â· {board.totalDurationSec}s / {board.targetDurationSec}s
                    </p>
                  </div>
                  <Badge tone={board.totalDurationSec === board.targetDurationSec ? "success" : "danger"}>
                    {board.totalDurationSec === board.targetDurationSec ? "Durations match" : "Fix durations"}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wide">CTA:</span> {board.cta}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Render queue"
          description={`${jobs.length} job(s). The worker claims one job at a time with SKIP LOCKED.`}
        />
        {jobs.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            No render jobs yet. Open a storyboard and choose <strong>Queue render</strong>.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {jobs.map(({ job, draftTitle, projectName, mediaId }) => (
              <li key={job.id} className="space-y-1 px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/studio/${job.draftId}#render`} className="font-medium text-slate-900">
                    {draftTitle || "Short video"}
                  </Link>
                  <Badge
                    tone={
                      job.status === "succeeded"
                        ? "success"
                        : job.status === "failed"
                          ? "danger"
                          : job.status === "running"
                            ? "info"
                            : "warning"
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {projectName} Â· queued {formatDateTime(job.createdAt)} Â· attempt {job.attempts}
                </p>
                {job.error ? <p className="text-xs text-rose-700">{job.error}</p> : null}
                {mediaId ? (
                  <a
                    className="text-xs font-medium text-indigo-700"
                    href={`/api/media/${mediaId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open rendered video
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Downstream publishing" />
        <div className="p-5 text-sm text-slate-600">
          Exported video links appear on scheduled posts. See{" "}
          <Link className={linkClass} href="/calendar">
            Publishing Calendar
          </Link>
          .
        </div>
      </Card>
    </div>
  );
}
