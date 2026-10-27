import Link from "next/link";
import { Card, CardHeader, PageHeader, linkClass } from "@/components/ui";
import { ManualErrorForm } from "@/components/manual-error-form";

export const dynamic = "force-dynamic";

export default function ReportErrorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report a problem"
        description="Create an incident record with the current route and enough context to reproduce it."
        actions={<Link className={linkClass} href="/operations/errors">Incident ledger</Link>}
      />
      <Card>
        <CardHeader title="Manual incident" description="Automatic reports are recorded without this form." />
        <ManualErrorForm />
      </Card>
    </div>
  );
}
