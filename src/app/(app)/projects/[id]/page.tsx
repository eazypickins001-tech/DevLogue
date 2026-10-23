import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { deleteProjectData, toggleProjectArchive, updateProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  FormMessage,
  PageHeader,
  SetupNotice,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  linkClass,
  mutedLinkClass,
} from "@/components/ui";
import { getOwner, requireSession } from "@/lib/auth";
import { getProject, listDraftsForProject, listSessions } from "@/lib/queries";
import {
  DRAFT_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  STAGE_LABELS,
  formatDate,
} from "@/lib/labels";
import { CONTENT_FORMATS, type ContentFormatValue } from "@/lib/domain/content";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const { error, message } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Project" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  await requireSession();
  const owner = await getOwner();
  const project = await getProject(owner.id, id);
  if (!project) notFound();

  const [sessions, drafts] = await Promise.all([
    listSessions(owner.id, project.id),
    listDraftsForProject(owner.id, project.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || "No description yet."}
        actions={
          <>
            <Badge tone={project.archivedAt ? "neutral" : "accent"}>
              {project.archivedAt ? "Archived" : STAGE_LABELS[project.stage]}
            </Badge>
            <Link href={`/sessions/new?projectId=${project.id}`} className={buttonPrimary}>
              Capture session
            </Link>
          </>
        }
      />
      <FormMessage message={error} />
      <FormMessage message={message} tone="success" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Build sessions"
              description={`${sessions.length} session(s) for this project.`}
              action={
                <Link className={mutedLinkClass} href={`/sessions?projectId=${project.id}`}>
                  View all
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No sessions documented"
                    description="Capture what you worked on, the problem, what changed, and what remains."
                    action={
                      <Link className={buttonPrimary} href={`/sessions/new?projectId=${project.id}`}>
                        Capture a session
                      </Link>
                    }
                  />
                </div>
              ) : (
                sessions.slice(0, 8).map(({ session, evidenceCount, draftCount }) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="block px-5 py-3 no-underline transition hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{session.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(session.createdAt)} · {evidenceCount} evidence · {draftCount} draft(s)
                        </p>
                      </div>
                      <Badge tone={session.status === "drafted" ? "success" : "neutral"}>
                        {SESSION_STATUS_LABELS[session.status] ?? session.status}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Content"
              description="Drafts generated from this project's sessions."
              action={
                <Link className={mutedLinkClass} href="/studio">
                  Studio
                </Link>
              }
            />
            <div className="divide-y divide-slate-100">
              {drafts.length === 0 ? (
                <div className="p-5 text-sm text-slate-600">
                  No drafts yet. Analyze a session and generate content from it.
                </div>
              ) : (
                drafts.map((row) => (
                  <Link
                    key={row.id}
                    href={`/studio/${row.id}`}
                    className="block px-5 py-3 no-underline transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {row.title || CONTENT_FORMATS[row.format as ContentFormatValue]?.label}
                      </p>
                      <Badge tone={row.status === "approved" ? "success" : "warning"}>
                        {DRAFT_STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {CONTENT_FORMATS[row.format as ContentFormatValue]?.label} · v{row.currentVersion} ·{" "}
                      {formatDate(row.updatedAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Edit project" description="Keep the context current; AI uses it." />
            <div className="p-5">
              <ProjectForm action={updateProject} project={project} submitLabel="Save project" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Context" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Problem</dt>
                <dd className="mt-0.5 text-slate-800">{project.problem || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Target users</dt>
                <dd className="mt-0.5 text-slate-800">{project.targetUsers || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Goals</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">
                  {project.goals.length ? project.goals.join("\n") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Platforms</dt>
                <dd className="mt-0.5 text-slate-800">
                  {project.platforms.length ? project.platforms.join(", ") : "—"}
                </dd>
              </div>
              {project.repoUrl ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Repository</dt>
                  <dd className="mt-0.5">
                    <a className={linkClass} href={project.repoUrl} target="_blank" rel="noreferrer">
                      {project.repoUrl}
                    </a>
                  </dd>
                </div>
              ) : null}
              {project.landingPageUrl || project.waitlistUrl || project.feedbackUrl ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Audience links</dt>
                  <dd className="mt-1 flex flex-col gap-1">
                    {project.landingPageUrl ? (
                      <a className={linkClass} href={project.landingPageUrl} target="_blank" rel="noreferrer">
                        Landing page
                      </a>
                    ) : null}
                    {project.waitlistUrl ? (
                      <a className={linkClass} href={project.waitlistUrl} target="_blank" rel="noreferrer">
                        Waiting list
                      </a>
                    ) : null}
                    {project.feedbackUrl ? (
                      <a className={linkClass} href={project.feedbackUrl} target="_blank" rel="noreferrer">
                        Feedback form
                      </a>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {project.publicationExclusions ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-rose-600">Publication exclusions</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-rose-800">
                    {project.publicationExclusions}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Archive" description="Archiving hides the project without deleting data." />
            <div className="p-5">
              <form action={toggleProjectArchive}>
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="archive" value={project.archivedAt ? "false" : "true"} />
                <SubmitButton className={buttonSecondary}>
                  {project.archivedAt ? "Restore project" : "Archive project"}
                </SubmitButton>
              </form>
            </div>
          </Card>

          <Card className="border-rose-200">
            <CardHeader
              title="Delete project"
              description="Deletes sessions, evidence, drafts and feedback. Media objects must be deleted individually first."
            />
            <form action={deleteProjectData} className="space-y-3 p-5">
              <input type="hidden" name="projectId" value={project.id} />
              <label className="block text-sm text-slate-700" htmlFor="confirmation">
                Type DELETE to confirm
              </label>
              <input
                id="confirmation"
                name="confirmation"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="DELETE"
                autoComplete="off"
              />
              <SubmitButton className={buttonDanger} pendingLabel="Deleting…">
                Delete permanently
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
