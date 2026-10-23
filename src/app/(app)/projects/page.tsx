import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Badge, Card, EmptyState, PageHeader, SetupNotice, buttonPrimary, linkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listProjects } from "@/lib/queries";
import { STAGE_LABELS, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; message?: string }>;
}) {
  const { archived, message } = await searchParams;
  const showArchived = archived === "1";

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projects" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const rows = await listProjects(owner.id, showArchived);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Each project keeps its own sessions, evidence, drafts and audience context."
        actions={
          <Link href="/projects/new" className={buttonPrimary}>
            New project
          </Link>
        }
      />
      {message ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={showArchived ? "/projects" : "/projects?archived=1"}
          className={showArchived ? linkClass : "text-slate-600 hover:text-slate-900"}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project for the product you are building now. You can add more later."
          action={
            <Link href="/projects/new" className={buttonPrimary}>
              Create your first project
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ project, sessionCount, draftCount }) => (
            <Card key={project.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-base font-semibold text-slate-900 no-underline hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {project.description || "No description yet."}
                  </p>
                </div>
                <Badge tone={project.archivedAt ? "neutral" : "accent"}>
                  {project.archivedAt ? "Archived" : STAGE_LABELS[project.stage]}
                </Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <dt className="uppercase tracking-wide">Sessions</dt>
                  <dd className="text-sm font-medium text-slate-800">{sessionCount}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Drafts</dt>
                  <dd className="text-sm font-medium text-slate-800">{draftCount}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Created</dt>
                  <dd className="text-slate-800">{formatDate(project.createdAt)}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Platforms</dt>
                  <dd className="text-slate-800">
                    {project.platforms.length > 0 ? project.platforms.join(", ") : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                <Link className={linkClass} href={`/projects/${project.id}`}>
                  Open
                </Link>
                <Link className={linkClass} href={`/sessions/new?projectId=${project.id}`}>
                  Capture session
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
