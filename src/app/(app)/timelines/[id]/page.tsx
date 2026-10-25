import Link from "next/link";
import { notFound } from "next/navigation";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import { Badge, PageHeader } from "@/components/ui";
import { getOwner, requireSession } from "@/lib/auth";
import { getTimelineDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();
  const owner = await getOwner();
  const detail = await getTimelineDetail(owner.id, id);
  if (!detail) notFound();

  const { timeline, project, session, recording, assets } = detail;
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
      <TimelineEditor
        timelineId={timeline.id}
        title={timeline.title}
        version={timeline.version}
        initialDocument={timeline.document}
        assets={media}
      />
    </div>
  );
}
