import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { createProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { PageHeader, SetupNotice, linkClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New project"
        description="A project holds sessions, evidence, drafts and audience context. You can manage several."
        actions={
          <Link className={linkClass} href="/projects">
            Back to projects
          </Link>
        }
      />
      {!isDatabaseConfigured() ? (
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code> before creating projects.
        </SetupNotice>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <ProjectForm action={createProject} submitLabel="Create project" />
      </div>
    </div>
  );
}
