import { desc } from "drizzle-orm";
import { updateUserRole, updateUserStatus } from "@/app/actions/users";
import {
  Badge,
  Card,
  CardHeader,
  FormMessage,
  PageHeader,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { message, error } = await searchParams;
  const rows = await getDb().select().from(users).orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Accounts are created on first email sign-in. Suspending a user blocks their next request immediately."
      />
      <FormMessage message={message} tone="success" />
      <FormMessage message={error} />

      <Card>
        <CardHeader
          title={`${rows.length} account${rows.length === 1 ? "" : "s"}`}
          description="You cannot change your own role or status. Keep at least one active admin."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">User</th>
                <th scope="col" className="px-5 py-3 font-medium">Role</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Created</th>
                <th scope="col" className="px-5 py-3 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const self = row.id === admin.id;
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{row.email}</p>
                      <p className="text-xs text-slate-500">
                        {row.name ?? "No display name"}
                        {self ? " · you" : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {self ? (
                        <Badge tone="info">admin</Badge>
                      ) : (
                        <form action={updateUserRole} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={row.id} />
                          <select
                            name="role"
                            defaultValue={row.role}
                            className={`${inputClass} w-28`}
                            aria-label={`Role for ${row.email}`}
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                          <button type="submit" className={buttonSecondary}>
                            Save
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Badge tone={row.status === "active" ? "success" : "danger"}>
                          {row.status}
                        </Badge>
                        {self ? null : (
                          <form action={updateUserStatus}>
                            <input type="hidden" name="userId" value={row.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={row.status === "active" ? "suspended" : "active"}
                            />
                            <button type="submit" className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                              {row.status === "active" ? "Suspend" : "Reactivate"}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(row.createdAt)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Never"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
