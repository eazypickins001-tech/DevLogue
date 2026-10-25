import Link from "next/link";
import { notFound } from "next/navigation";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import { Badge, Card, CardHeader, FormMessage, PageHeader } from "@/components/ui";
import { getOwner, requireSession } from "@/lib/auth";
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
  const detail = await getTimelineDetail(owner.id, id);
  if (!detail) notFound();
  const renderJobs = await listTimelineRenderJobs(id);

  const { timeline, project, session, recording, assets } = detail;
  const transcription = recording ? await getTimelineTranscription(recording.id) : null;
  const media = assets.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    kind: asset.kind,
    contentType: asset.contentType,
    url: `/api/media/${asset.id}`,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={timeline.title}
        description={`${project.name}${session ? ` - ${session.title}` : ""}`}
        actions={
          <>
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
    </div>
  );
}
