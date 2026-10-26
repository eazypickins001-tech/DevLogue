import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, linkClass } from "@/components/ui";
import { isDatabaseConfigured } from "@/db";
import { getServiceStatuses, aiProviderName } from "@/lib/env";
import { getOwner, ownerEmail } from "@/lib/auth";
import { getStorageSummary, type StorageSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PHASES = [
  {
    name: "Phase 1 — Foundation",
    status: "Done",
    detail: "Auth gate, Neon schema + migration, projects, build sessions, private evidence uploads.",
  },
  {
    name: "Phase 2 — AI content",
    status: "Done",
    detail:
      "Provider abstraction, validated session analysis, on-demand content, storyboards, versioning, approval, deterministic quality checks.",
  },
  {
    name: "Phase 3 - Video workflow",
    status: "Done",
    detail:
      "Recording, multi-track timeline, captions, previews, sync offsets, local rendering and timeline-to-draft publishing.",
  },
  {
    name: "Phase 4 — Publishing",
    status: "Partial",
    detail:
      "GHL capabilities verified and documented; scheduling is gated behind credentials, so approved drafts use a handoff view.",
  },
  {
    name: "Phase 5 — Hardening",
    status: "Ongoing",
    detail: "Tests, build verification, accessibility, authorization and secrets audit.",
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

export default async function SettingsPage() {
  const services = getServiceStatuses();
  let storage: StorageSummary | null = null;
  if (isDatabaseConfigured()) {
    storage = await getStorageSummary((await getOwner()).id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configuration is environment-based. No secrets are stored in the database or sent to the browser."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workspace" />
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Owner</dt>
              <dd className="font-medium text-slate-900">{ownerEmail()}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Auth model</dt>
              <dd className="text-slate-800">Single password + signed session cookie</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">AI provider</dt>
              <dd className="text-slate-800">{aiProviderName()}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Session lifetime</dt>
              <dd className="text-slate-800">14 days</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Environment" description="Names only. Values stay on the server." />
          <ul className="divide-y divide-slate-100">
            {services.map((service) => (
              <li key={service.key} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{service.label}</span>
                  <Badge tone={service.configured ? "success" : "warning"}>
                    {service.configured ? "Set" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-0.5 font-mono text-xs text-slate-500">
                  {service.envVars.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Build status" description="Reported honestly, including what is not finished." />
        <ul className="divide-y divide-slate-100">
          {PHASES.map((phase) => (
            <li key={phase.name} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-slate-900">{phase.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">{phase.detail}</p>
              </div>
              <Badge
                tone={phase.status === "Done" ? "success" : phase.status === "Partial" ? "warning" : "info"}
              >
                {phase.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Data and retention" />
        <div className="space-y-2 p-5 text-sm text-slate-700">
          <p>
            Content lives in your Neon database. Media lives in your private R2 bucket and is served
            through short-lived signed URLs after an auth check.
          </p>
          <p>
            There is no automatic purge. Delete individual media from a session, delete a timeline to remove its rendered video, or delete a project to remove its database records and all related R2 media, renders, thumbnails, waveforms and pending multipart uploads.
          </p>
          <p>
            AI prompts include session text and evidence text only. Media files are never uploaded to the
            model provider by this application.
          </p>
        </div>
      </Card>

      {storage ? (
        <Card>
          <CardHeader
            title="Storage"
            description="Recorded media and renders stored in your private R2 bucket."
          />
          <div className="space-y-4 p-5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                {formatBytes(storage.totalBytes)}
              </p>
              <p className="text-xs text-slate-500">{storage.assetCount} media assets</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {storage.byKind.map((row) => (
                <div key={row.kind} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {row.kind}
                  </p>
                  <p className="mt-1 font-medium text-slate-900">{formatBytes(row.bytes)}</p>
                  <p className="text-xs text-slate-500">
                    {row.count} item{row.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
            {storage.byProject.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Largest projects
                </p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {storage.byProject.map((project) => (
                    <li key={project.id ?? "unassigned"} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-slate-800">{project.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatBytes(project.bytes)} - {project.count} asset
                        {project.count === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              Sizes are recorded when assets are uploaded. Thumbnails and waveforms live under their
              parent asset; this summary does not list R2 objects orphaned outside the database.
            </p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Operations" />
        <div className="space-y-2 p-5 text-sm text-slate-700">
          <p>
            Migrations: <code className="font-mono">pnpm db:generate</code> then{" "}
            <code className="font-mono">pnpm db:migrate</code>.
          </p>
          <p>
            Checks: <code className="font-mono">pnpm lint</code>,{" "}
            <code className="font-mono">pnpm typecheck</code>, <code className="font-mono">pnpm test</code>,{" "}
            <code className="font-mono">pnpm build</code>.
          </p>
          <p>
            Setup details are in <code className="font-mono">README.md</code>. The original brief is at{" "}
            <code className="font-mono">docs/PROJECT_PROMPT.md</code>.
          </p>
          <p>
            <Link className={linkClass} href="/integrations">
              Connection checks →
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
