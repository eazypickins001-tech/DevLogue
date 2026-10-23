import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, linkClass } from "@/components/ui";
import { IntegrationChecks } from "@/components/integration-checks";
import { getServiceStatuses } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  const services = getServiceStatuses();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connection state comes from environment variables, not from optimistic UI."
        actions={
          <Link className={linkClass} href="/settings">
            Environment reference
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <Card key={service.key} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{service.label}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{service.requiredFor}</p>
              </div>
              <Badge tone={service.configured ? "success" : "warning"}>
                {service.configured ? "Configured" : "Not configured"}
              </Badge>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Required variables
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-700">
                  {service.envVars.join(", ")}
                </p>
              </div>
              <p className="text-slate-600">{service.setup}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Live connection checks"
          description="Read-only probes. No posts are created or changed."
        />
        <div className="p-5">
          <IntegrationChecks />
        </div>
      </Card>

      <Card>
        <CardHeader title="GoHighLevel capabilities (verified)" />
        <div className="space-y-2 p-5 text-sm text-slate-700">
          <p>
            HighLevel&apos;s Social Planner API supports listing connected accounts and creating a post
            with <code className="font-mono">status: draft</code>,{" "}
            <code className="font-mono">scheduled</code> or <code className="font-mono">published</code>.
          </p>
          <p className="font-mono text-xs text-slate-600">
            GET /social-media-posting/{"{locationId}"}/accounts
            <br />
            POST /social-media-posting/{"{locationId}"}/posts · Version: 2021-07-28
          </p>
          <p>
            Required body fields include <code className="font-mono">accountIds</code>,{" "}
            <code className="font-mono">type</code> and <code className="font-mono">userId</code>. The
            integration adapter is deliberately shipped with a test mode and an export fallback; live
            scheduling needs verified account IDs.
          </p>
        </div>
      </Card>
    </div>
  );
}
