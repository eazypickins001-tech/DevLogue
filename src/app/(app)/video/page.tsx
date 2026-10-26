import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader, SetupNotice, linkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listRenderJobsForUser, listStoryboardDrafts } from "@/lib/queries";
import { WorkerControl } from "@/components/worker-control";
import { formatDate, formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function VideoPage() {
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
  const [boards, jobs] = await Promise.all([
    listStoryboardDrafts(owner.id),
    listRenderJobsForUser(owner.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Production"
        description="Storyboards are ready to edit. Automated rendering is a local-worker feature, not a Vercel request."
      />

      <SetupNotice title="Rendering runs on your machine">
        <p>
          Queue a render from a storyboard, then run the worker. It trims and loops clips, scales to
          1080×1920, burns captions, adds an audio track, validates with ffprobe and uploads to R2.
        </p>
        <p className="font-mono text-xs">pnpm worker · pnpm worker:once · ffmpeg 9.0.2 · faster-whisper base.en</p>
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
        </div>
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
                      {projectName} · {formatDate(board.createdAt)} · {sceneCount} scenes ·{" "}
                      {linkedScenes} linked to media · {board.totalDurationSec}s / {board.targetDurationSec}s
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
                  {projectName} · queued {formatDateTime(job.createdAt)} · attempt {job.attempts}
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
