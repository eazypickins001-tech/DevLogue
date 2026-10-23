import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader, SetupNotice, linkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listScheduledPosts, listStoryboardDrafts } from "@/lib/queries";
import { formatDate } from "@/lib/labels";

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
  const [boards, posts] = await Promise.all([
    listStoryboardDrafts(owner.id),
    listScheduledPosts(owner.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Production"
        description="Storyboards are ready to edit. Automated rendering is a local-worker feature, not a Vercel request."
      />

      <SetupNotice title="Render worker not installed in this build">
        <p>
          Storyboards, scene-to-asset mapping, captions and editing instructions work now. Automatic
          assembly needs FFmpeg and Whisper installed locally; the worker is scaffolded in phase 3.
        </p>
        <p className="font-mono text-xs">
          ffmpeg: not detected · whisper: not detected · render jobs: {posts.length === 0 ? "none" : `${posts.length} scheduled`}
        </p>
      </SetupNotice>

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
        <CardHeader title="Render queue" description="Render jobs are created by the local worker." />
        <div className="p-5 text-sm text-slate-600">
          No render jobs. When the worker is installed, jobs are queued here and processed outside the
          web request lifecycle so the dashboard stays responsive.
        </div>
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
