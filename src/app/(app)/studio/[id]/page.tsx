import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { approveDraft, archiveDraft, regenerateDraft, updateDraft } from "@/app/actions/content";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field, TextArea, TextInput } from "@/components/form-fields";
import { QualityList } from "@/components/quality-list";
import { StoryboardView } from "@/components/storyboard-view";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  Card,
  CardHeader,
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
import { getDraftDetail, getSessionDetail } from "@/lib/queries";
import { DRAFT_STATUS_LABELS, formatDateTime } from "@/lib/labels";
import { CONTENT_FORMATS, lintContent, type ContentFormatValue, type LintIssue } from "@/lib/domain/content";
import { storyboardIssues } from "@/lib/domain/storyboard";
import { buildEvidenceCorpus } from "@/lib/services/content";

export const dynamic = "force-dynamic";

export default async function DraftPage({
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
        <PageHeader title="Draft" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  await requireSession();
  const owner = await getOwner();
  const detail = await getDraftDetail(owner.id, id);
  if (!detail) notFound();

  const { draft, project, session, analysis, versions, approvals, storyboard, scenes } = detail;
  const sessionDetail = session ? await getSessionDetail(owner.id, session.id) : null;
  const corpus = sessionDetail ? buildEvidenceCorpus(sessionDetail) : "";
  const assetNames = new Map(
    (sessionDetail?.media ?? []).map((asset) => [asset.id, asset.filename]),
  );
  const format = draft.format as ContentFormatValue;
  const spec = CONTENT_FORMATS[format];

  const issues: LintIssue[] = [];
  if (format === "short_video" && storyboard) {
    issues.push(
      ...lintContent(`${storyboard.hook}\n${storyboard.cta}`, {
        evidenceCorpus: corpus,
        minChars: 10,
      }),
    );
    for (const issue of storyboardIssues({
      targetDurationSec: storyboard.targetDurationSec,
      totalDurationSec: storyboard.totalDurationSec,
      scenes,
    })) {
      issues.push({ code: "storyboard", severity: "error", message: issue });
    }
  } else if (format === "x_thread") {
    const posts = Array.isArray(draft.payload?.posts) ? (draft.payload.posts as string[]) : [];
    posts.forEach((post, index) => {
      for (const issue of lintContent(post, { platform: "x", minChars: 20 })) {
        issues.push({ ...issue, message: `Post ${index + 1}: ${issue.message}` });
      }
    });
  } else {
    issues.push(
      ...lintContent(draft.body, {
        platform: spec?.platform,
        evidenceCorpus: corpus || undefined,
        minChars: 20,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={draft.title || spec?.label || "Draft"}
        description={`${project.name}${session ? ` · ${session.title}` : ""} · version ${draft.currentVersion}`}
        actions={
          <>
            <Badge
              tone={
                draft.status === "approved"
                  ? "success"
                  : draft.status === "archived"
                    ? "neutral"
                    : "warning"
              }
            >
              {DRAFT_STATUS_LABELS[draft.status] ?? draft.status}
            </Badge>
            {session ? (
              <Link className={mutedLinkClass} href={`/sessions/${session.id}`}>
                Session
              </Link>
            ) : null}
            <Link className={mutedLinkClass} href="/studio">
              Studio
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
              title="Draft"
              description={`${spec?.label ?? format} · ${spec?.platform ?? "other"} · saved ${formatDateTime(
                draft.updatedAt,
              )}`}
              action={
                draft.approvedVersion ? (
                  <span className="text-xs text-slate-500">
                    Approved version: {draft.approvedVersion}
                  </span>
                ) : null
              }
            />
            <form action={updateDraft} className="space-y-4 p-5">
              <input type="hidden" name="draftId" value={draft.id} />
              <Field label="Title (optional)" htmlFor="title">
                <TextInput name="title" defaultValue={draft.title} maxLength={200} />
              </Field>
              <Field label="Body" htmlFor="body" hint="Editing creates a new version; the previous one is kept.">
                <TextArea name="body" rows={18} defaultValue={draft.body} required maxLength={20000} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton className={buttonPrimary} pendingLabel="Saving version…">
                  Save new version
                </SubmitButton>
                <span className="text-xs text-slate-500">
                  Saving resets approval so the edited version is reviewed again.
                </span>
              </div>
            </form>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3">
              <form action={approveDraft}>
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="note" value="" />
                <SubmitButton className={buttonSecondary} pendingLabel="Approving…">
                  Approve version {draft.currentVersion}
                </SubmitButton>
              </form>
              <form action={regenerateDraft}>
                <input type="hidden" name="draftId" value={draft.id} />
                <SubmitButton className={buttonSecondary} pendingLabel="Regenerating…">
                  Regenerate with AI
                </SubmitButton>
              </form>
              <form action={archiveDraft}>
                <input type="hidden" name="draftId" value={draft.id} />
                <ConfirmSubmit
                  message="Archive this draft? The approved version stays in history."
                  className={buttonDanger}
                >
                  Archive
                </ConfirmSubmit>
              </form>
            </div>
          </Card>

          {storyboard && scenes.length > 0 ? (
            <Card>
              <CardHeader
                title="Storyboard"
                description="Use this table directly in your editor. Scene durations are normalized."
              />
              <div className="p-5">
                <StoryboardView board={storyboard} scenes={scenes} assetNames={assetNames} />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Version history"
              description="AI drafts, user edits and approvals are distinct."
            />
            <ul className="divide-y divide-slate-100">
              {versions.map((version) => (
                <li key={version.id} className="px-5 py-3">
                  <details>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium text-slate-900">v{version.version}</span>{" "}
                      <span className="text-slate-500">
                        {version.source === "ai" ? "AI draft" : "Your edit"} ·{" "}
                        {formatDateTime(version.createdAt)}
                      </span>
                    </summary>
                    <pre className="prose-draft mt-2 max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 font-sans">
                      {version.body}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Quality checks"
              description="Deterministic checks. Warnings need your judgement, not automatic fixes."
            />
            <div className="p-5">
              <QualityList issues={issues} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Approval" />
            <div className="space-y-3 p-5 text-sm">
              {approvals.length === 0 ? (
                <p className="text-slate-600">Not approved yet. Approval does not publish anything.</p>
              ) : (
                <ul className="space-y-2">
                  {approvals.map((approval) => (
                    <li key={approval.id} className="rounded-lg border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">Version {approval.version} approved</p>
                      <p className="text-xs text-slate-500">
                        {approval.approvedBy} · {formatDateTime(approval.approvedAt)}
                      </p>
                      {approval.note ? <p className="mt-1 text-xs text-slate-600">{approval.note}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500">
                Scheduling and publishing are intentionally not automatic. See the{" "}
                <Link className={linkClass} href="/calendar">
                  publishing calendar
                </Link>
                .
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Source" description="The analysis this draft came from." />
            <div className="space-y-2 p-5 text-sm">
              {analysis ? (
                <>
                  <p className="text-slate-700">
                    {analysis.model} · {analysis.provider}
                  </p>
                  <p className="text-xs text-slate-500">
                    {analysis.tokensIn ?? "?"} in / {analysis.tokensOut ?? "?"} out
                    {analysis.costUsd ? ` · $${Number(analysis.costUsd).toFixed(5)}` : " · cost not reported"}
                  </p>
                  {analysis.summary ? (
                    <div className="space-y-2 pt-2">
                      <p>
                        <span className="font-medium text-slate-900">Problem:</span>{" "}
                        {analysis.summary.problem}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Best demo:</span>{" "}
                        {analysis.summary.bestDemo}
                      </p>
                      {analysis.summary.evidenceGaps.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                          Gaps: {analysis.summary.evidenceGaps.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-slate-600">The linked analysis is missing.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
