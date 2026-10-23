import Link from "next/link";
import { scheduleDraftWithGhl, deleteScheduledPost } from "@/app/actions/publishing";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field, TextInput } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, CardHeader, buttonPrimary, hintClass, linkClass } from "@/components/ui";
import { PLATFORM_LABELS, type PlatformValue } from "@/lib/domain/content";
import { formatDateTime } from "@/lib/labels";
import { isTestMode } from "@/lib/domain/publishing";
import type { publishingAccounts, scheduledPosts } from "@/db/schema";

type Account = typeof publishingAccounts.$inferSelect;
type Post = typeof scheduledPosts.$inferSelect;

export function PublishPanel({
  draftId,
  projectId,
  approved,
  accounts,
  posts,
  hasVideo,
}: {
  draftId: string;
  projectId: string;
  approved: boolean;
  accounts: Account[];
  posts: Post[];
  hasVideo: boolean;
}) {
  const testMode = isTestMode();

  return (
    <Card id="publishing">
      <CardHeader
        title="Publishing handoff"
        description="HighLevel Social Planner. Approval and publishing are separate actions."
        action={
          <Badge tone={testMode ? "warning" : "danger"}>{testMode ? "Test mode" : "Live mode"}</Badge>
        }
      />
      <div className="space-y-4 p-5">
        {!approved ? (
          <p className="text-sm text-slate-600">
            Approve this draft first. Nothing is sent to HighLevel until you approve and submit the
            handoff form.
          </p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-slate-600">
            No publishing accounts saved for this project. Add them on the{" "}
            <Link className={linkClass} href={`/projects/${projectId}`}>
              project page
            </Link>{" "}
            first.
          </p>
        ) : (
          <form action={scheduleDraftWithGhl} className="space-y-4">
            <input type="hidden" name="draftId" value={draftId} />
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Target accounts</legend>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        name="accountIds"
                        value={account.externalAccountId}
                        defaultChecked={accounts.length === 1}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="truncate text-slate-800">
                        {account.displayName ?? account.externalAccountId}
                      </span>
                      <span className="ml-auto text-[10px] uppercase text-slate-400">
                        {PLATFORM_LABELS[account.platform as PlatformValue] ?? account.platform}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Schedule (local time)" htmlFor="scheduledAt">
                <TextInput name="scheduledAt" type="datetime-local" disabled={testMode} />
              </Field>
              <Field label="Timezone" htmlFor="timezone">
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue="Africa/Kigali"
                  disabled={testMode}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {[
                    "Africa/Kigali",
                    "Africa/Nairobi",
                    "Africa/Lagos",
                    "Europe/London",
                    "Europe/Berlin",
                    "America/New_York",
                    "UTC",
                  ].map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {testMode ? (
              <p className={hintClass}>
                Test mode creates a draft in HighLevel. Schedule fields are ignored until you set{" "}
                <code className="font-mono">GHL_TEST_MODE=false</code>.
              </p>
            ) : (
              <p className={hintClass}>
                This will create a scheduled post in HighLevel. Make sure the account, date and
                caption are correct.
              </p>
            )}
            <SubmitButton className={buttonPrimary} pendingLabel="Sending to HighLevel…">
              {testMode ? "Create HighLevel draft" : "Schedule post"}
            </SubmitButton>
          </form>
        )}

        {posts.length > 0 ? (
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              HighLevel posts
            </h3>
            <ul className="mt-2 space-y-2">
              {posts.map((post) => (
                <li key={post.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {post.status}
                      {post.externalPostId ? (
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {post.externalPostId.slice(0, 10)}
                        </span>
                      ) : null}
                    </span>
                    <Badge
                      tone={
                        post.status === "published"
                          ? "success"
                          : post.status === "failed"
                            ? "danger"
                            : "info"
                      }
                    >
                      {post.provider}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {post.scheduledAt ? formatDateTime(post.scheduledAt) : "No schedule (draft)"} ·{" "}
                    {post.timezone}
                  </p>
                  {post.error ? <p className="mt-1 text-xs text-rose-700">{post.error}</p> : null}
                  {["draft", "failed"].includes(post.status) ? (
                    <form action={deleteScheduledPost} className="mt-2">
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="draftId" value={draftId} />
                      <ConfirmSubmit message="Remove this HighLevel post and its DevLogue record?">
                        Remove
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!hasVideo ? (
          <p className={hintClass}>
            No video media is attached to this session. Reels require a video upload; text formats
            work without media.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
