import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary } from "@/components/ui";
import type { buildSessions } from "@/db/schema";

type SessionRecord = typeof buildSessions.$inferSelect;

export function SessionForm({
  action,
  projects,
  session,
  defaultProjectId,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  projects: { id: string; name: string }[];
  session?: SessionRecord;
  defaultProjectId?: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Project" htmlFor="projectId">
          <Select
            name="projectId"
            required
            defaultValue={session?.projectId ?? defaultProjectId ?? projects[0]?.id}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
        </Field>
        <Field label="Session title" htmlFor="title" hint="Short and specific, e.g. 'Fixed R2 upload CORS'.">
          <TextInput name="title" defaultValue={session?.title} required maxLength={160} />
        </Field>
      </div>
      <Field label="What did you work on?" htmlFor="workedOn">
        <TextArea name="workedOn" rows={3} defaultValue={session?.workedOn} required maxLength={4000} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Problem encountered" htmlFor="problem">
          <TextArea name="problem" rows={3} defaultValue={session?.problem} maxLength={4000} />
        </Field>
        <Field label="Why the problem mattered" htmlFor="whyItMatters">
          <TextArea name="whyItMatters" rows={3} defaultValue={session?.whyItMatters} maxLength={2000} />
        </Field>
      </div>
      <Field label="What changed?" htmlFor="changes" hint="Files, behaviour, decisions. Plain language.">
        <TextArea name="changes" rows={4} defaultValue={session?.changes} maxLength={6000} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="What worked" htmlFor="worked">
          <TextArea name="worked" rows={3} defaultValue={session?.worked} maxLength={4000} />
        </Field>
        <Field label="What failed" htmlFor="failed">
          <TextArea name="failed" rows={3} defaultValue={session?.failed} maxLength={4000} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="What did you learn?" htmlFor="learned">
          <TextArea name="learned" rows={3} defaultValue={session?.learned} maxLength={4000} />
        </Field>
        <Field label="What remains unfinished?" htmlFor="unfinished">
          <TextArea name="unfinished" rows={3} defaultValue={session?.unfinished} maxLength={4000} />
        </Field>
      </div>
      <Field label="Next task" htmlFor="nextTask">
        <TextInput name="nextTask" defaultValue={session?.nextTask} maxLength={1000} />
      </Field>
      <Checkbox
        name="publishable"
        label="This material is safe to publish (no secrets, customers or private business logic)"
        defaultChecked={session?.publishable}
      />
      <SubmitButton className={buttonPrimary} pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
