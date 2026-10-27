import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { PageHeader, SetupNotice, linkClass } from "@/components/ui";
import { RecorderClient } from "@/components/recorder/recorder-client";
import { getOwner, requireSession } from "@/lib/auth";
import { getStorageSummary, listSessions } from "@/lib/queries";
import { formatStorageBytes, storageWarningLevel, storageWarningThreshold } from "@/lib/storage-policy";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { sessionId } = await searchParams;
  await requireSession();

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Record a session" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code> to save recordings to a session.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [rows, storage] = await Promise.all([listSessions(owner.id), getStorageSummary(owner.id)]);
  const warningThreshold = storageWarningThreshold();
  const storageWarning = storageWarningLevel(storage.totalBytes, warningThreshold) === "warning";
  const sessions = rows.map(({ session, projectName }) => ({
    id: session.id,
    title: session.title,
    projectName,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record a session"
        description="Capture your screen, camera, microphone and system audio. Camera visibility is a timeline setting, so you can hide or reveal the PiP after recording."
        actions={
          <Link className={linkClass} href="/sessions/new">
            New session
          </Link>
        }
      />
      {storageWarning ? (
        <SetupNotice title="Storage warning">
          <p>
            Media storage is {formatStorageBytes(storage.totalBytes)}, above the configured{" "}
            {formatStorageBytes(warningThreshold)} warning threshold. Large recordings can fill the
            bucket.
          </p>
          <p>
            <Link className={linkClass} href="/operations/storage">
              Review storage and clean up R2
            </Link>
          </p>
        </SetupNotice>
      ) : null}
      {sessions.length === 0 ? (
        <SetupNotice title="Create a destination session first">
          <p>
            Every recording is saved into a build session. Create a project, then create a build
            session; that session becomes the editing studio destination.
          </p>
          <p className="flex flex-wrap gap-3">
            <Link className={linkClass} href="/projects/new">
              Create a project
            </Link>
            <Link className={linkClass} href="/sessions/new">
              Create a build session
            </Link>
          </p>
        </SetupNotice>
      ) : null}
      <RecorderClient sessions={sessions} initialSessionId={sessionId} />
    </div>
  );
}
