import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { createFeedback, setFeedbackStatus } from "@/app/actions/feedback";
import { Field, Select, TextArea, TextInput } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  FormMessage,
  PageHeader,
  SetupNotice,
  buttonPrimary,
  buttonSecondary,
  linkClass,
} from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { listFeedback, listProjects } from "@/lib/queries";
import { FEEDBACK_KIND_LABELS, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

const KINDS = Object.keys(FEEDBACK_KIND_LABELS);

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Feedback" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [projects, items] = await Promise.all([listProjects(owner.id), listFeedback(owner.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audience feedback"
        description="Track what followers and testers tell you. Manual entry only; nothing is imported behind your back."
      />
      <FormMessage message={error} />
      <FormMessage message={message} tone="success" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Record feedback" />
          <div className="p-5">
            {projects.length === 0 ? (
              <EmptyState
                title="Create a project first"
                description="Feedback is attached to a project so it can inform content and roadmap."
                action={
                  <Link href="/projects/new" className={buttonPrimary}>
                    New project
                  </Link>
                }
              />
            ) : (
              <form action={createFeedback} className="space-y-4">
                <Field label="Project" htmlFor="projectId">
                  <Select
                    name="projectId"
                    required
                    options={projects.map(({ project }) => ({ value: project.id, label: project.name }))}
                  />
                </Field>
                <Field label="Type" htmlFor="kind">
                  <Select
                    name="kind"
                    defaultValue="general"
                    options={KINDS.map((kind) => ({
                      value: kind,
                      label: FEEDBACK_KIND_LABELS[kind] ?? kind,
                    }))}
                  />
                </Field>
                <Field label="Where it came from" htmlFor="source" hint="Instagram DM, X reply, demo call…">
                  <TextInput name="source" defaultValue="manual" maxLength={120} />
                </Field>
                <Field label="Contact (optional)" htmlFor="contact">
                  <TextInput name="contact" placeholder="name or email" maxLength={200} />
                </Field>
                <Field label="What did they say?" htmlFor="body">
                  <TextArea name="body" rows={4} required maxLength={4000} />
                </Field>
                <SubmitButton className={buttonPrimary} pendingLabel="Saving…">
                  Save feedback
                </SubmitButton>
              </form>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Feedback inbox"
            description={`${items.length} item(s). Tagged feedback is separate from measured analytics.`}
          />
          {items.length === 0 ? (
            <div className="p-5 text-sm text-slate-600">
              Nothing yet. Ask one specific question at the end of your next post.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map(({ item, projectName }) => (
                <li key={item.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{FEEDBACK_KIND_LABELS[item.kind] ?? item.kind}</Badge>
                      <Badge tone={item.status === "new" ? "warning" : item.status === "actioned" ? "success" : "neutral"}>
                        {item.status}
                      </Badge>
                      <span className="text-xs text-slate-500">{projectName}</span>
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-800">{item.body}</p>
                  <p className="text-xs text-slate-500">
                    Source: {item.source}
                    {item.contact ? ` · ${item.contact}` : ""}
                  </p>
                  <form action={setFeedbackStatus} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="feedbackId" value={item.id} />
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      {["new", "reviewed", "actioned", "archived"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className={buttonSecondary} pendingLabel="Updating…">
                      Update status
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-slate-500">
        Waiting-list signups are not imported automatically. Add the link on the{" "}
        <Link className={linkClass} href="/projects">
          project
        </Link>{" "}
        and record verified numbers only.
      </p>
    </div>
  );
}
