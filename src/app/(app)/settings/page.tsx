import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, linkClass } from "@/components/ui";
import { getServiceStatuses, aiProviderName } from "@/lib/env";
import { ownerEmail } from "@/lib/auth";

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
    name: "Phase 3 — Video workflow",
    status: "Partial",
    detail:
      "Storyboards and scene-to-asset mapping work. Local FFmpeg/Whisper render worker is scaffolded but not installed.",
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

export default function SettingsPage() {
  const services = getServiceStatuses();

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
            There is no automatic purge. Delete media from a session, delete a project, or remove rows
            directly. Deleting a project cascades sessions, evidence, drafts and feedback in the
            database; storage objects must be deleted per asset.
          </p>
          <p>
            AI prompts include session text and evidence text only. Media files are never uploaded to the
            model provider by this application.
          </p>
        </div>
      </Card>

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
