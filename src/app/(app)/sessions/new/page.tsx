import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { createSession } from "@/app/actions/sessions";
import { SessionForm } from "@/components/session-form";
import { EmptyState, PageHeader, SetupNotice, buttonPrimary, linkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listProjects } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; error?: string }>;
}) {
  const { projectId, error } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Capture session" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const projects = await listProjects(owner.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capture session"
        description="Fast entry now, useful evidence later. Only the title and what you worked on are required."
        actions={
          <Link className={linkClass} href="/sessions">
            Back to sessions
          </Link>
        }
      />
      {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {projects.length === 0 ? (
        <EmptyState
          title="Create a project first"
          description="Sessions belong to a project so content keeps the right context."
          action={
            <Link href="/projects/new" className={buttonPrimary}>
              Create project
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SessionForm
            action={createSession}
            projects={projects.map(({ project }) => ({ id: project.id, name: project.name }))}
            defaultProjectId={projectId}
            submitLabel="Save session"
          />
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recording the session</h2>
        <p className="mt-1">
          Keep a screen recording running while you work. Add it after saving the session, along with
          commits or pull requests. DevLogue stores uploads privately and only sends text you choose
          to the AI provider.
        </p>
      </div>
    </div>
  );
}
