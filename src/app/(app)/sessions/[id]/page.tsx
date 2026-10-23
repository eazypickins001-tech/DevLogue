import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { analyzeSession } from "@/app/actions/analysis";
import { generateContent } from "@/app/actions/content";
import { deleteMedia } from "@/app/actions/media";
import { addEvidence, archiveSession, deleteEvidence, updateSession } from "@/app/actions/sessions";
import { AnalysisCard } from "@/components/analysis-view";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field, Select, TextArea, TextInput } from "@/components/form-fields";
import { MediaUploader } from "@/components/media-uploader";
import { SessionForm } from "@/components/session-form";
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
import { isAiConfigured } from "@/lib/env";
import { isStorageConfigured } from "@/lib/storage";
import { getSessionDetail, listProjects } from "@/lib/queries";
import {
  DRAFT_STATUS_LABELS,
  EVIDENCE_KIND_LABELS,
  SESSION_STATUS_LABELS,
  formatBytes,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { CONTENT_FORMATS, CONTENT_FORMAT_VALUES, type ContentFormatValue } from "@/lib/domain/content";
import { EVIDENCE_KINDS } from "@/lib/validation";
import type { Analysis } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

const DEFAULT_FORMATS: ContentFormatValue[] = ["linkedin_post", "x_post", "short_video"];

export default async function SessionDetailPage({
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
      <div className="space-y-5">
        <PageHeader title="Build session" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  await requireSession();
  const owner = await getOwner();
  const detail = await getSessionDetail(owner.id, id);
  if (!detail) notFound();
  const projects = await listProjects(owner.id);

  const { session, project, evidence, media, analyses, drafts } = detail;
  const analysis = analyses.find((item) => item.status === "succeeded" && item.summary);
  const summary = analysis?.summary as Analysis | null;
  const assetNames = new Map(media.map((asset) => [asset.id, asset.filename]));
  const totalMediaBytes = media.reduce((sum, asset) => sum + asset.sizeBytes, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={session.title}
        description={`${project.name} · ${formatDate(session.createdAt)}`}
        actions={
          <>
            <Badge tone={session.publishable ? "success" : "warning"}>
              {session.publishable ? "Safe to publish" : "Privacy review needed"}
            </Badge>
            <Badge tone="neutral">{SESSION_STATUS_LABELS[session.status] ?? session.status}</Badge>
            <Link className={mutedLinkClass} href={`/projects/${project.id}`}>
              Project
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
              title="Session notes"
              description="The evidence base. Edit anything that is wrong before generating content."
              action={<span className="text-xs text-slate-500">Updated {formatDateTime(session.updatedAt)}</span>}
            />
            <dl className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["Worked on", session.workedOn],
                ["Problem", session.problem],
                ["Why it mattered", session.whyItMatters],
                ["Changes", session.changes],
                ["Worked", session.worked],
                ["Failed", session.failed],
                ["Learned", session.learned],
                ["Unfinished", session.unfinished],
                ["Next task", session.nextTask],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <details className="border-t border-slate-100 px-5 py-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Edit session</summary>
              <div className="pt-4">
                <SessionForm
                  action={updateSession}
                  projects={projects.map(({ project: item }) => ({ id: item.id, name: item.name }))}
                  session={session}
                  submitLabel="Save changes"
                />
              </div>
            </details>
          </Card>

          <Card id="evidence">
            <CardHeader
              title="Evidence"
              description="Commits, pull requests, releases, screenshots, recordings. AI may only cite what exists here."
              action={
                <span className="text-xs text-slate-500">
                  {evidence.length} item(s) · {evidence.filter((item) => item.verified).length} verified
                </span>
              }
            />
            <div className="divide-y divide-slate-100">
              {evidence.length === 0 ? (
                <div className="p-5 text-sm text-slate-600">
                  No evidence attached yet. Without it, content claims will be flagged as unverified.
                </div>
              ) : (
                evidence.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <Badge tone="neutral">{EVIDENCE_KIND_LABELS[item.kind] ?? item.kind}</Badge>
                        <Badge tone={item.verified ? "success" : "warning"}>
                          {item.verified ? "Verified" : "Unverified"}
                        </Badge>
                      </div>
                      {item.body ? <p className="mt-1 text-sm text-slate-700">{item.body}</p> : null}
                      {item.url ? (
                        <a className="mt-1 block break-all text-xs text-indigo-700" href={item.url} target="_blank" rel="noreferrer">
                          {item.url}
                        </a>
                      ) : null}
                      <p className="mt-1 font-mono text-[11px] text-slate-400">id: {item.id.slice(0, 8)}</p>
                    </div>
                    <form action={deleteEvidence}>
                      <input type="hidden" name="evidenceId" value={item.id} />
                      <input type="hidden" name="sessionId" value={session.id} />
                      <ConfirmSubmit message="Remove this evidence from the session?" className={buttonDanger}>
                        Remove
                      </ConfirmSubmit>
                    </form>
                  </div>
                ))
              )}
            </div>
            <details className="border-t border-slate-100 px-5 py-3" open={evidence.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Add evidence</summary>
              <form action={addEvidence} className="grid gap-4 pt-4 md:grid-cols-2">
                <input type="hidden" name="sessionId" value={session.id} />
                <Field label="Kind" htmlFor="kind">
                  <Select
                    name="kind"
                    defaultValue="commit"
                    options={EVIDENCE_KINDS.map((kind) => ({
                      value: kind,
                      label: EVIDENCE_KIND_LABELS[kind] ?? kind,
                    }))}
                  />
                </Field>
                <Field label="Title" htmlFor="title">
                  <TextInput name="title" required placeholder="fix: serialize R2 uploads" maxLength={200} />
                </Field>
                <Field label="URL" htmlFor="url" hint="Commit, PR, release or screenshot link.">
                  <TextInput name="url" type="url" placeholder="https://github.com/…" />
                </Field>
                <Field label="Reference" htmlFor="externalRef" hint="Commit SHA, PR number, release tag.">
                  <TextInput name="externalRef" placeholder="a1b2c3d" maxLength={300} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Notes or transcript excerpt" htmlFor="body">
                    <TextArea name="body" rows={3} placeholder="What this proves." maxLength={8000} />
                  </Field>
                </div>
                <Field label="Occurred at" htmlFor="occurredAt">
                  <TextInput name="occurredAt" type="date" />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                  <input type="checkbox" name="verified" className="h-4 w-4 rounded border-slate-300" />
                  I verified this evidence myself
                </label>
                <div className="md:col-span-2">
                  <SubmitButton className={buttonSecondary} pendingLabel="Adding…">
                    Add evidence
                  </SubmitButton>
                </div>
              </form>
            </details>
          </Card>

          <Card>
            <CardHeader
              title="Media"
              description={`${media.length} private asset(s) · ${formatBytes(totalMediaBytes)}`}
            />
            <div className="p-5">
              {isStorageConfigured() ? (
                <MediaUploader sessionId={session.id} />
              ) : (
                <SetupNotice title="Uploads need Cloudflare R2">
                  <p>
                    Add <code className="font-mono">R2_ACCOUNT_ID</code>,{" "}
                    <code className="font-mono">R2_ACCESS_KEY_ID</code>,{" "}
                    <code className="font-mono">R2_SECRET_ACCESS_KEY</code> and{" "}
                    <code className="font-mono">R2_BUCKET</code>, then configure a CORS policy that
                    allows PUT from this origin.
                  </p>
                  <p>
                    <Link className={linkClass} href="/integrations">
                      Integration setup →
                    </Link>
                  </p>
                </SetupNotice>
              )}
            </div>
            {media.length > 0 ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {media.map((asset) => (
                  <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{asset.filename}</p>
                      <p className="text-xs text-slate-500">
                        {asset.kind} · {asset.contentType} · {formatBytes(asset.sizeBytes)} · private
                        {asset.durationSeconds ? ` · ${Number(asset.durationSeconds).toFixed(1)}s` : ""}
                      </p>
                      {asset.notes ? <p className="mt-0.5 text-xs text-slate-600">{asset.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <a className={linkClass} href={`/api/media/${asset.id}`} target="_blank" rel="noreferrer">
                        Open
                      </a>
                      <form action={deleteMedia}>
                        <input type="hidden" name="mediaId" value={asset.id} />
                        <ConfirmSubmit message={`Delete ${asset.filename} from storage?`}>
                          Delete
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {summary && analysis ? (
            <div id="analysis">
              <AnalysisCard
                summary={summary}
                model={analysis.model}
                createdAt={analysis.createdAt}
                tokensIn={analysis.tokensIn}
                tokensOut={analysis.tokensOut}
                costUsd={analysis.costUsd}
              />
            </div>
          ) : null}

          <Card id="drafts">
            <CardHeader
              title="Content"
              description="Generate only the formats you plan to use. Short-video storyboards reference your uploaded media."
              action={<Link className={mutedLinkClass} href="/studio">Open studio</Link>}
            />
            <div className="space-y-4 p-5">
              <form action={analyzeSession} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="sessionId" value={session.id} />
                <SubmitButton className={buttonPrimary} pendingLabel="Analyzing…">
                  {summary ? "Re-run analysis" : "Analyze session"}
                </SubmitButton>
                <span className="text-xs text-slate-500">
                  {isAiConfigured()
                    ? "Structured output is validated before it is saved."
                    : "AI is not configured yet."}
                </span>
              </form>

              <form action={generateContent} className="space-y-4 border-t border-slate-100 pt-4">
                <input type="hidden" name="sessionId" value={session.id} />
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">
                    Formats to generate (maximum 3 per batch)
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {CONTENT_FORMAT_VALUES.filter((format) => format !== "case_study").map((format) => (
                      <label key={format} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                        <input
                          type="checkbox"
                          name="formats"
                          value={format}
                          defaultChecked={DEFAULT_FORMATS.includes(format)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {CONTENT_FORMATS[format].label}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {CONTENT_FORMATS[format].description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Storyboard target duration (seconds)" htmlFor="targetDurationSec">
                  <Select
                    name="targetDurationSec"
                    defaultValue="45"
                    options={[30, 45, 60, 90].map((value) => ({
                      value: String(value),
                      label: `${value}s`,
                    }))}
                  />
                </Field>
                <SubmitButton className={buttonPrimary} pendingLabel="Generating…">
                  Generate content
                </SubmitButton>
                <p className="text-xs text-slate-500">
                  Each call can take 20-60 seconds. On Vercel Hobby, keep batches small.
                </p>
              </form>
            </div>
            {drafts.length > 0 ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {drafts.map((draft) => (
                  <li key={draft.id}>
                    <Link
                      href={`/studio/${draft.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 no-underline transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {draft.title || CONTENT_FORMATS[draft.format as ContentFormatValue]?.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {CONTENT_FORMATS[draft.format as ContentFormatValue]?.label} · v
                          {draft.currentVersion} · {formatDate(draft.updatedAt)}
                        </p>
                      </div>
                      <Badge tone={draft.status === "approved" ? "success" : "warning"}>
                        {DRAFT_STATUS_LABELS[draft.status] ?? draft.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Evidence summary" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Evidence items</dt>
                <dd className="font-medium text-slate-900">{evidence.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Verified</dt>
                <dd className="font-medium text-slate-900">
                  {evidence.filter((item) => item.verified).length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Media</dt>
                <dd className="font-medium text-slate-900">{media.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Analyses</dt>
                <dd className="font-medium text-slate-900">{analyses.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Drafts</dt>
                <dd className="font-medium text-slate-900">{drafts.length}</dd>
              </div>
            </dl>
          </Card>

          {analyses.length > 0 ? (
            <Card>
              <CardHeader title="Analysis history" description="Oldest first." />
              <ul className="divide-y divide-slate-100">
                {[...analyses].reverse().map((item) => (
                  <li key={item.id} className="px-5 py-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-700">{item.model}</span>
                      <Badge tone={item.status === "succeeded" ? "success" : item.status === "failed" ? "danger" : "neutral"}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-slate-500">{formatDateTime(item.createdAt)}</p>
                    {item.error ? <p className="mt-1 text-rose-700">{item.error}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Privacy" description="Before publishing anything." />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p>
                Uploads are private by default. AI prompts contain session text and evidence text, not
                media files.
              </p>
              <p>
                Check recordings for terminal windows, .env files, customer data and browser tabs before
                sharing publicly.
              </p>
              {project.sensitiveNotes ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <p className="font-medium">Project notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{project.sensitiveNotes}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Archive session" description="Hides it from the active list." />
            <form action={archiveSession} className="p-5">
              <input type="hidden" name="sessionId" value={session.id} />
              <SubmitButton className={buttonSecondary}>Archive session</SubmitButton>
            </form>
          </Card>
        </div>
      </div>

      {drafts.length === 0 && evidence.length === 0 ? (
        <EmptyState
          title="Add evidence before generating content"
          description="Content built without evidence is guesswork. Attach at least one commit, screenshot or note."
        />
      ) : null}
    </div>
  );
}
