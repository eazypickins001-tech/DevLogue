import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Card, CardHeader, PageHeader, SetupNotice, Stat, linkClass } from "@/components/ui";
import { getOwner } from "@/lib/auth";
import { getDashboardData, listDrafts, listUsage } from "@/lib/queries";
import { DRAFT_STATUS_LABELS, formatDateTime } from "@/lib/labels";
import { CONTENT_FORMATS, type ContentFormatValue } from "@/lib/domain/content";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" />
        <SetupNotice title="Database required">
          Set <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">pnpm db:migrate</code>.
        </SetupNotice>
      </div>
    );
  }

  const owner = await getOwner();
  const [data, drafts, usage] = await Promise.all([
    getDashboardData(owner.id),
    listDrafts(owner.id),
    listUsage(owner.id),
  ]);

  const byFormat = new Map<string, number>();
  for (const { draft } of drafts) {
    byFormat.set(draft.format, (byFormat.get(draft.format) ?? 0) + 1);
  }
  const byStatus = new Map<string, number>();
  for (const { draft } of drafts) {
    byStatus.set(draft.status, (byStatus.get(draft.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Counts from your own workspace. Audience metrics are not imported because no platform API is connected."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions documented" value={data.counts.sessionCount} />
        <Stat label="Drafts generated" value={data.counts.draftCount} />
        <Stat label="Approved" value={data.counts.approvedCount} />
        <Stat label="Published" value={data.counts.publishedCount} hint="Requires provider integration" />
        <Stat label="Failures" value={data.counts.failedCount} />
        <Stat label="Feedback" value={data.counts.feedbackCount} />
        <Stat label="AI calls" value={data.usage.calls} />
        <Stat
          label="Reported AI cost"
          value={data.usage.totalCost ? `$${Number(data.usage.totalCost).toFixed(4)}` : "—"}
          hint="Only when the provider reports cost"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Drafts by format" description="What you actually generate." />
          <div className="p-5">
            {byFormat.size === 0 ? (
              <p className="text-sm text-slate-600">No drafts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...byFormat.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([format, count]) => (
                    <li key={format} className="flex items-center justify-between gap-3">
                      <span className="text-slate-700">
                        {CONTENT_FORMATS[format as ContentFormatValue]?.label ?? format}
                      </span>
                      <span className="font-medium text-slate-900">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Drafts by status" description="Where work is waiting." />
          <div className="p-5">
            {byStatus.size === 0 ? (
              <p className="text-sm text-slate-600">No drafts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...byStatus.entries()].map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">{DRAFT_STATUS_LABELS[status] ?? status}</span>
                    <span className="font-medium text-slate-900">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="AI usage"
          description="Tokens are measured. Cost appears only when the provider returns it."
        />
        <div className="overflow-x-auto">
          {usage.length === 0 ? (
            <p className="p-5 text-sm text-slate-600">No AI calls yet.</p>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2">When</th>
                  <th className="px-5 py-2">Task</th>
                  <th className="px-5 py-2">Model</th>
                  <th className="px-5 py-2">Tokens in</th>
                  <th className="px-5 py-2">Tokens out</th>
                  <th className="px-5 py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-5 py-2 text-slate-600">{formatDateTime(row.createdAt)}</td>
                    <td className="px-5 py-2 text-slate-800">{row.task}</td>
                    <td className="px-5 py-2 text-slate-700">{row.model}</td>
                    <td className="px-5 py-2 text-slate-600">{row.tokensIn ?? "—"}</td>
                    <td className="px-5 py-2 text-slate-600">{row.tokensOut ?? "—"}</td>
                    <td className="px-5 py-2 text-slate-600">
                      {row.costUsd ? `$${Number(row.costUsd).toFixed(5)}` : "not reported"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">What this cannot tell you yet</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Views, likes, saves and follows are not imported; no platform analytics API is connected.</li>
          <li>Waiting-list signups are manual until a verified integration is configured.</li>
          <li>
            Engagement is not product-market fit. Use{" "}
            <Link className={linkClass} href="/feedback">
              tagged feedback
            </Link>{" "}
            to judge whether the content attracts the right people.
          </li>
        </ul>
      </div>
    </div>
  );
}
