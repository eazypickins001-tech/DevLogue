import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/form-fields";
import { buttonPrimary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PLATFORM_LABELS, type PlatformValue } from "@/lib/domain/content";
import { PLATFORMS, PROJECT_STAGES } from "@/lib/validation";
import { STAGE_LABELS } from "@/lib/labels";
import type { projects } from "@/db/schema";

type ProjectRecord = typeof projects.$inferSelect;

export function ProjectForm({
  action,
  project,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  project?: ProjectRecord;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      {project ? <input type="hidden" name="projectId" value={project.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Project name" htmlFor="name">
          <TextInput name="name" defaultValue={project?.name} required maxLength={120} />
        </Field>
        <Field label="Stage" htmlFor="stage">
          <Select
            name="stage"
            defaultValue={project?.stage ?? "building"}
            options={PROJECT_STAGES.map((stage) => ({
              value: stage,
              label: STAGE_LABELS[stage] ?? stage,
            }))}
          />
        </Field>
      </div>
      <Field label="Short description" htmlFor="description">
        <TextArea name="description" rows={2} defaultValue={project?.description} maxLength={2000} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Problem being solved" htmlFor="problem">
          <TextArea name="problem" rows={3} defaultValue={project?.problem} maxLength={4000} />
        </Field>
        <Field label="Target users" htmlFor="targetUsers">
          <TextArea name="targetUsers" rows={3} defaultValue={project?.targetUsers} maxLength={2000} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Repository URL" htmlFor="repoUrl" hint="Public or private; only metadata is stored.">
          <TextInput name="repoUrl" type="url" defaultValue={project?.repoUrl} placeholder="https://github.com/…" />
        </Field>
        <Field label="Working directory" htmlFor="workingDir" hint="Local reference only. DevLogue never reads this path.">
          <TextInput name="workingDir" defaultValue={project?.workingDir} placeholder="C:\\Users\\you\\Projects\\app" />
        </Field>
      </div>
      <Field label="Goals and milestones" htmlFor="goals" hint="One per line.">
        <TextArea name="goals" rows={4} defaultValue={project?.goals?.join("\n")} maxLength={4000} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Positioning" htmlFor="positioning">
          <TextArea name="positioning" rows={2} defaultValue={project?.positioning} maxLength={2000} />
        </Field>
        <Field label="Preferred tone" htmlFor="tone" hint="e.g. dry, technical, first person, no hype.">
          <TextArea name="tone" rows={2} defaultValue={project?.tone} maxLength={500} />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Preferred platforms</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLATFORMS.map((platform) => (
            <Checkbox
              key={platform}
              name="platforms"
              defaultValue={platform}
              label={PLATFORM_LABELS[platform as PlatformValue]}
              defaultChecked={project?.platforms?.includes(platform as PlatformValue)}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Launch status" htmlFor="launchStatus">
          <TextInput name="launchStatus" defaultValue={project?.launchStatus} placeholder="Pre-launch, private beta…" />
        </Field>
        <Field label="Landing page URL" htmlFor="landingPageUrl">
          <TextInput name="landingPageUrl" type="url" defaultValue={project?.landingPageUrl} />
        </Field>
        <Field label="Waiting-list URL" htmlFor="waitlistUrl">
          <TextInput name="waitlistUrl" type="url" defaultValue={project?.waitlistUrl} />
        </Field>
      </div>
      <Field label="Feedback link" htmlFor="feedbackUrl">
        <TextInput name="feedbackUrl" type="url" defaultValue={project?.feedbackUrl} />
      </Field>
      <Field
        label="Sensitive information"
        htmlFor="sensitiveNotes"
        hint="Reminders for you. These notes are never sent to an AI provider."
      >
        <TextArea name="sensitiveNotes" rows={3} defaultValue={project?.sensitiveNotes} maxLength={4000} />
      </Field>
      <Field
        label="Publication exclusions"
        htmlFor="publicationExclusions"
        hint="Topics, customers or details that must never appear in content."
      >
        <TextArea
          name="publicationExclusions"
          rows={3}
          defaultValue={project?.publicationExclusions}
          maxLength={4000}
        />
      </Field>
      <SubmitButton className={buttonPrimary} pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
