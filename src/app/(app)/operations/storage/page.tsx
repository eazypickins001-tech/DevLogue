import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { Card, CardHeader, PageHeader, SetupNotice, linkClass } from "@/components/ui";
import { StorageAudit } from "@/components/storage-audit";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  await requireSession();
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Storage audit" />
        <SetupNotice title="Database required">Set DATABASE_URL and run pnpm db:migrate.</SetupNotice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage audit"
        description="Compare R2 objects with database keys without deleting anything until you explicitly confirm."
        actions={<Link className={linkClass} href="/settings">Storage summary</Link>}
      />
      <Card>
        <CardHeader
          title="R2 orphan scan"
          description="Audits media, renders and derivatives. Database-backed keys are never treated as orphans."
        />
        <div className="p-5">
          <StorageAudit />
        </div>
      </Card>
      <Card>
        <CardHeader title="Safety model" />
        <div className="space-y-2 p-5 text-sm text-slate-700">
          <p>Scanning is read-only. The delete action re-reads the database before removing keys.</p>
          <p>Only keys under media/, renders/ and derivatives/ are eligible. Other bucket objects are ignored.</p>
          <p>Deletion is irreversible. Take an R2 snapshot or lifecycle backup before broad cleanup.</p>
        </div>
      </Card>
    </div>
  );
}
