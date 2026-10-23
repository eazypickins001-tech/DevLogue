import type { Analysis } from "@/lib/ai/schemas";
import { Badge, Card, CardHeader } from "@/components/ui";

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisView({ summary }: { summary: Analysis }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">Status: {summary.status}</Badge>
        {summary.evidenceGaps.length > 0 ? (
          <Badge tone="warning">
            {summary.evidenceGaps.length} evidence gap{summary.evidenceGaps.length === 1 ? "" : "s"}
          </Badge>
        ) : (
          <Badge tone="success">No evidence gaps listed</Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Problem</h3>
          <p className="mt-1 text-sm text-slate-800">{summary.problem}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attempted solution</h3>
          <p className="mt-1 text-sm text-slate-800">{summary.attemptedSolution}</p>
        </div>
      </div>

      <Section title="Actual changes" items={summary.actualChanges} />
      <Section title="Evidence" items={summary.evidence} />
      <Section title="Tests and checks" items={summary.tests} />
      <Section title="Failures" items={summary.failures} />
      <Section title="Lessons" items={summary.lessons} />
      <Section title="Open questions" items={summary.openQuestions} />
      <Section title="Content angles" items={summary.contentAngles} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best demo</h3>
          <p className="mt-1 text-sm text-slate-800">{summary.bestDemo}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience benefit</h3>
          <p className="mt-1 text-sm text-slate-800">{summary.audienceBenefit}</p>
        </div>
      </div>

      {summary.evidenceGaps.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Missing information
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {summary.evidenceGaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.claims.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Claims</h3>
          <ul className="mt-2 space-y-2">
            {summary.claims.map((claim, index) => (
              <li key={index} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-slate-800">{claim.text}</p>
                  <Badge tone={claim.verified ? "success" : "warning"}>
                    {claim.verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                {claim.evidenceIds.length > 0 ? (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    evidence: {claim.evidenceIds.join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">No evidence ids attached.</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AnalysisCard({
  summary,
  model,
  createdAt,
  tokensIn,
  tokensOut,
  costUsd,
}: {
  summary: Analysis;
  model: string;
  createdAt: Date | string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Session analysis"
        description={`${model} · ${new Date(createdAt).toLocaleString("en-GB")}${
          costUsd ? ` · $${Number(costUsd).toFixed(5)} reported` : " · cost not reported"
        }`}
        action={
          <span className="text-xs text-slate-500">
            {tokensIn ?? "?"} in / {tokensOut ?? "?"} out
          </span>
        }
      />
      <div className="p-5">
        <AnalysisView summary={summary} />
      </div>
    </Card>
  );
}
