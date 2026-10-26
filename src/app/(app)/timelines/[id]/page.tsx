import Link from "next/link";
import { notFound } from "next/navigation";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  Badge,
  Card,
  CardHeader,
  FormMessage,
  PageHeader,
  buttonDanger,
  buttonPrimary,
} from "@/components/ui";
import { createTimelineDraft, deleteTimeline } from "@/app/actions/recordings";
import { getOwner, requireSession } from "@/lib/auth";
import { getWorkerSnapshot } from "@/lib/worker-status";
import { WorkerStatusPill } from "@/components/worker-status-pill";
import { ensureDerivativeJobsForRecording } from "@/lib/services/derivatives";
import {
  getTimelineDetail,
  getTimelineTranscription,
  listTimelineRenderJobs,
} from "@/lib/queries";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const { error, message } = await searchParams;
  await requireSession();
  const owner = await getOwner();
  const worker = await getWorkerSnapshot();
  const detail = await getTimelineDetail(owner.id, id);
  if (!detail) notFound();
  if (detail.recording) await ensureDerivativeJobsForRecording(detail.recording.id);
  const renderJobs = await listTimelineRenderJobs(id);

  const { timeline, project, session, recording, assets } = detail;
  const transcription = recording ? await getTimelineTranscription(recording.id) : null;
  const hasRendered = renderJobs.some(({ job }) => job.status === "succeeded");
  const media = assets.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    kind: asset.kind,
    contentType: asset.contentType,
    url: `/api/media/${asset.id}`,
    thumbnailUrl: asset.thumbnailKey ? `/api/media/${asset.id}/thumbnail` : null,
    waveformUrl: asset.waveformKey ? `/api/media/${asset.id}/waveform` : null,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={timeline.title}
        description={`${project.name}${session ? ` - ${session.title}` : ""}`}
        actions={
          <>
            <WorkerStatusPill snapshot={worker} />
            <Badge tone="neutral">v{timeline.version}</Badge>
            {recording ? <Badge tone="info">{recording.source}</Badge> : null}
            {session ? (
              <Link className="text-sm text-slate-600 hover:text-slate-900" href={`/sessions/${session.id}`}>
                Session
              </Link>
            ) : null}
            <Link className="text-sm text-slate-600 hover:text-slate-900" href={`/projects/${project.id}`}>
              Project
            </Link>
          </>
        }
      />
      <FormMessage message={error} />
      <FormMessage message={message} tone="success" />
      <TimelineEditor
        timelineId={timeline.id}
        title={timeline.title}
        version={timeline.version}
        initialDocument={timeline.document}
        assets={media}
        transcription={{
          hasAudio: transcription?.hasAudio ?? false,
          hasTranscript: Boolean(transcription?.transcript?.segments.length),
          segmentCount: transcription?.transcript?.segments.length ?? 0,
          jobStatus: transcription?.job?.status ?? null,
          jobError: transcription?.job?.error ?? null,
        }}
      />
      <Card>
        <CardHeader
          title="Send to Content Studio"
          description="Editing saves the timeline. Content Studio receives a short-video draft only after a successful render."
        />
        <div className="space-y-3 p-5 text-sm text-slate-700">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Edit and save the timeline.</li>
            <li>Queue final render and run the worker.</li>
            <li>Create the content draft and finish it in Content Studio.</li>
          </ol>
          {timeline.draftId ? (
            <Link className={buttonPrimary} href={`/studio/${timeline.draftId}`}>
              Open content draft
            </Link>
          ) : hasRendered ? (
            <form action={createTimelineDraft}>
              <input type="hidden" name="timelineId" value={timeline.id} />
              <button type="submit" className={buttonPrimary}>
                Create content draft
              </button>
            </form>
          ) : (
            <p className="text-slate-600">
              No successful render yet. Use <strong>Queue final render</strong> in the editor, start the
              worker, then return here.
            </p>
          )}
        </div>
      </Card>

      <Card id="render">
        <CardHeader
          title="Render queue"
          description="Final MP4 rendering runs on the Contabo/local worker. Start it with pnpm worker."
        />
        {renderJobs.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">
            No timeline renders yet. Use <strong>Queue final render</strong> in the editor.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {renderJobs.map(({ job, mediaId }) => (
              <li key={job.id} className="space-y-1 px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">Timeline render</span>
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
                  Queued {formatDateTime(job.createdAt)} - attempt {job.attempts}
                  {job.status === "running" ? ` - ${job.progress}%` : ""}
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
      <Card className="border-rose-200">
        <CardHeader
          title="Delete timeline"
          description="Deletes this timeline and its rendered video. Raw recording tracks stay in the session."
        />
        <form action={deleteTimeline} className="p-5">
          <input type="hidden" name="timelineId" value={timeline.id} />
          <ConfirmSubmit
            message="Delete this timeline and its rendered video? Raw recording tracks will be kept."
            className={buttonDanger}
          >
            Delete timeline
          </ConfirmSubmit>
        </form>
      </Card>
    </div>
  );
}
