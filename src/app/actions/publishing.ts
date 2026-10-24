"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  mediaAssets,
  projects,
  publishingAccounts,
  publishingJobs,
  scheduledPosts,
} from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import {
  createGhlPost,
  deleteGhlPost,
  getGhlUserId,
  isGhlConfigured,
  listGhlAccounts,
  uploadMediaFile,
  uploadMediaToGhl,
} from "@/lib/publishing/ghl";
import { createHandoffToken, isPublicAppUrl, publicAppUrl } from "@/lib/publishing/handoff";
import {
  ghlMediaLimitBytes,
  ghlMediaType,
  isTestMode,
  postTypeForFormat,
  resolvePostStatus,
  zonedLocalToUtcIso,
} from "@/lib/domain/publishing";
import { findScheduleConflicts, normalizeTimezone } from "@/lib/domain/schedule";
import { readObjectBytes } from "@/lib/storage";
import { redirectError, redirectSuccess } from "@/lib/forms";
import type { ContentFormatValue } from "@/lib/domain/content";
import { getDraftDetail } from "@/lib/queries";
import { formatZodError, formString } from "@/lib/validation";

const accountInput = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  platform: z.enum(["instagram", "youtube", "linkedin", "x", "tiktok", "facebook", "threads", "bluesky", "other"]),
  type: z.string().trim().max(50).nullable().optional(),
});

export type AvailableAccount = z.infer<typeof accountInput>;

export async function loadGhlAccounts(): Promise<
  { ok: true; accounts: AvailableAccount[] } | { ok: false; error: string }
> {
  await requireSession();
  if (!isGhlConfigured()) {
    return { ok: false, error: "GoHighLevel is not configured." };
  }
  try {
    const accounts = await listGhlAccounts();
    return {
      ok: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        platform: account.platform,
        type: account.type,
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load accounts." };
  }
}

export async function saveProjectAccounts(input: {
  projectId: string;
  accounts: AvailableAccount[];
}): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  const owner = await getOwner();
  const parsed = z.array(accountInput).max(100).safeParse(input.accounts);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const db = getDb();
  const ownedProject = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.userId, owner.id)))
    .limit(1);
  if (ownedProject.length === 0) return { ok: false, error: "Project not found." };

  const existing = await db
    .select()
    .from(publishingAccounts)
    .where(
      and(
        eq(publishingAccounts.projectId, input.projectId),
        eq(publishingAccounts.provider, "ghl"),
      ),
    );
  const selectedIds = new Set(parsed.data.map((account) => account.id));

  for (const account of parsed.data) {
    await db
      .insert(publishingAccounts)
      .values({
        projectId: input.projectId,
        provider: "ghl",
        externalAccountId: account.id,
        platform: account.platform,
        displayName: account.name,
      })
      .onConflictDoUpdate({
        target: [
          publishingAccounts.projectId,
          publishingAccounts.provider,
          publishingAccounts.externalAccountId,
        ],
        set: { platform: account.platform, displayName: account.name },
      });
  }

  const removable = existing.filter((account) => !selectedIds.has(account.externalAccountId));
  for (const account of removable) {
    const used = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.accountId, account.id));
    if ((used[0]?.count ?? 0) === 0) {
      await db.delete(publishingAccounts).where(eq(publishingAccounts.id, account.id));
    }
  }

  return { ok: true };
}

async function uploadDraftMedia(draftId: string, sessionId: string): Promise<{
  media: Array<{ url: string; type: "image" | "video" }>;
  warnings: string[];
}> {
  const db = getDb();
  const assets = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.sessionId, sessionId));
  const media: Array<{ url: string; type: "image" | "video" }> = [];
  const warnings: string[] = [];

  const base = publicAppUrl();
  const canHandoff = isPublicAppUrl(base);

  for (const asset of assets) {
    const type = ghlMediaType(asset.kind);
    if (!type) continue;
    if (asset.sizeBytes > ghlMediaLimitBytes(type)) {
      warnings.push(`${asset.filename} is larger than HighLevel's ${type} limit and was skipped.`);
      continue;
    }
    try {
      let uploaded: { fileId: string; url: string };
      if (canHandoff) {
        const handoffUrl = `${base}/api/publishing-media/${createHandoffToken(asset.id)}`;
        uploaded = await uploadMediaToGhl({ fileUrl: handoffUrl, name: asset.filename });
      } else if (asset.sizeBytes <= 25 * 1024 * 1024) {
        const bytes = await readObjectBytes(asset.storageKey);
        uploaded = await uploadMediaFile({
          bytes,
          filename: asset.filename,
          contentType: asset.contentType,
        });
      } else {
        throw new Error(
          "Set APP_PUBLIC_URL to a public HTTPS URL so HighLevel can fetch this large file.",
        );
      }
      media.push({ url: uploaded.url, type });
    } catch (error) {
      warnings.push(
        `${asset.filename}: ${error instanceof Error ? error.message : "media upload failed"}`,
      );
    }
  }

  if (warnings.length > 0) {
    throw new Error(
      `Media could not be prepared for draft ${draftId.slice(0, 8)}: ${warnings.join(" | ")}`,
    );
  }
  return { media, warnings };
}

export async function scheduleDraftWithGhl(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const draftId = formString(formData, "draftId");
  if (!isGhlConfigured()) {
    redirectError(`/studio/${draftId}`, "GoHighLevel is not configured. Add the GHL variables first.");
  }

  const owner = await getOwner();
  const detail = await getDraftDetail(owner.id, draftId);
  if (!detail) redirectError("/studio", "Draft not found.");
  if (detail.draft.status !== "approved" || !detail.draft.approvedVersion) {
    redirectError(`/studio/${draftId}`, "Approve this draft before handing it to HighLevel.");
  }

  const accountIds = formData.getAll("accountIds").map(String).filter(Boolean);
  if (accountIds.length === 0) {
    redirectError(`/studio/${draftId}`, "Select at least one publishing account.");
  }

  const db = getDb();
  const accounts = await db
    .select()
    .from(publishingAccounts)
    .where(
      and(
        eq(publishingAccounts.projectId, detail.project.id),
        eq(publishingAccounts.provider, "ghl"),
        inArray(publishingAccounts.externalAccountId, accountIds),
      ),
    );
  if (accounts.length === 0) {
    redirectError(`/studio/${draftId}`, "The selected accounts are not saved for this project.");
  }

  const testMode = isTestMode();
  const timezone = normalizeTimezone(formString(formData, "timezone"));
  const localDateTime = formString(formData, "scheduledAt");
  let scheduledAt: Date | null = null;

  if (!testMode) {
    if (!localDateTime) {
      redirectError(`/studio/${draftId}`, "Choose a date and time for the scheduled post.");
    }
    const iso = zonedLocalToUtcIso(localDateTime, timezone);
    if (!iso) {
      redirectError(`/studio/${draftId}`, "The schedule date or timezone is invalid.");
    }
    scheduledAt = new Date(iso);
    if (scheduledAt.getTime() < Date.now() + 2 * 60 * 1000) {
      redirectError(`/studio/${draftId}`, "Schedule the post at least two minutes in the future.");
    }
  }

  const status = resolvePostStatus({ testMode, scheduledAt });
  if (status === "scheduled" && !scheduledAt) {
    redirectError(`/studio/${draftId}`, "A scheduled post needs a date and time.");
  }

  const format = detail.draft.format as ContentFormatValue;
  const postType = postTypeForFormat(format);
  if (postType === "reel" && !detail.session?.id) {
    redirectError(`/studio/${draftId}`, "Attach this draft to a session with video media first.");
  }

  let mediaResult: { media: Array<{ url: string; type: "image" | "video" }>; warnings: string[] };
  try {
    mediaResult = detail.session?.id
      ? await uploadDraftMedia(draftId, detail.session.id)
      : { media: [], warnings: [] };
  } catch (error) {
    redirectError(
      `/studio/${draftId}`,
      error instanceof Error ? error.message : "Media preparation failed.",
    );
  }

  if (postType === "reel" && !mediaResult.media.some((item) => item.type === "video")) {
    redirectError(
      `/studio/${draftId}`,
      "A reel needs a video asset on the session before it can be handed to HighLevel.",
    );
  }

  let userId: string;
  try {
    userId = await getGhlUserId();
  } catch (error) {
    redirectError(
      `/studio/${draftId}`,
      error instanceof Error ? error.message : "Could not resolve the HighLevel user.",
    );
  }

  const existingPosts = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.draftId, draftId));

  const results: string[] = [];
  const failures: string[] = [];

  for (const account of accounts) {
    const already = existingPosts.find(
      (post) =>
        post.accountId === account.id && ["draft", "scheduled", "publishing"].includes(post.status),
    );
    if (already) {
      failures.push(
        `${account.displayName ?? account.platform}: already has a ${already.status} post in DevLogue.`,
      );
      continue;
    }

    if (status === "scheduled" && scheduledAt) {
      const conflicts = findScheduleConflicts(
        existingPosts
          .filter((post) => post.accountId === account.id)
          .map((post) => ({
            id: post.id,
            accountId: post.accountId,
            scheduledAt: post.scheduledAt,
            status: post.status,
          })),
        { accountId: account.id, scheduledAt, status },
      );
      if (conflicts.length > 0) {
        failures.push(`${account.displayName ?? account.platform}: ${conflicts[0].reason}`);
        continue;
      }
    }

    try {
      const created = await createGhlPost({
        accountId: account.externalAccountId,
        userId,
        summary: detail.draft.body,
        type: postType,
        status,
        scheduledAt,
        media: mediaResult.media,
      });

      const inserted = await db
        .insert(scheduledPosts)
        .values({
          draftId,
          projectId: detail.project.id,
          accountId: account.id,
          provider: "ghl",
          scheduledAt,
          timezone,
          status: status === "scheduled" ? "scheduled" : "draft",
          externalPostId: created.postId,
          attempts: 1,
          approvedAt: new Date(),
        })
        .returning({ id: scheduledPosts.id });

      await db.insert(publishingJobs).values({
        scheduledPostId: inserted[0].id,
        status: "succeeded",
        request: {
          accountId: account.externalAccountId,
          type: postType,
          status,
          mediaCount: mediaResult.media.length,
          scheduledAt: scheduledAt?.toISOString() ?? null,
        },
        response: { postId: created.postId, status: created.status },
        attempts: 1,
      });

      results.push(
        `${account.displayName ?? account.platform} (${status}${created.postId ? ` ${created.postId.slice(0, 8)}` : ""})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "HighLevel rejected the post.";
      const inserted = await db
        .insert(scheduledPosts)
        .values({
          draftId,
          projectId: detail.project.id,
          accountId: account.id,
          provider: "ghl",
          scheduledAt,
          timezone,
          status: "failed",
          error: message.slice(0, 1000),
          attempts: 1,
          approvedAt: new Date(),
        })
        .returning({ id: scheduledPosts.id });
      await db.insert(publishingJobs).values({
        scheduledPostId: inserted[0].id,
        status: "failed",
        request: { accountId: account.externalAccountId, type: postType, status },
        lastError: message.slice(0, 1000),
        attempts: 1,
      });
      failures.push(`${account.displayName ?? account.platform}: ${message}`);
    }
  }

  const summary = [
    testMode ? "Test mode: nothing was published." : "",
    results.length > 0 ? `Created: ${results.join(", ")}.` : "",
    failures.length > 0 ? `Failed: ${failures.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (results.length === 0) {
    redirectError(`/studio/${draftId}`, summary || "No posts were created.");
  }
  redirectSuccess(`/studio/${draftId}`, summary);
}


export async function deleteScheduledPost(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const postId = formString(formData, "postId");
  const draftId = formString(formData, "draftId");
  const owner = await getOwner();
  const db = getDb();
  const rows = await db
    .select({ post: scheduledPosts })
    .from(scheduledPosts)
    .innerJoin(projects, eq(scheduledPosts.projectId, projects.id))
    .where(and(eq(scheduledPosts.id, postId), eq(projects.userId, owner.id)))
    .limit(1);
  const post = rows[0]?.post;
  if (!post) redirectError(`/studio/${draftId}`, "Post not found.");
  if (!["draft", "failed", "scheduled"].includes(post.status)) {
    redirectError(
      `/studio/${draftId}`,
      "Only draft, failed or scheduled posts can be removed from DevLogue.",
    );
  }
  if (post.externalPostId && isGhlConfigured()) {
    try {
      await deleteGhlPost(post.externalPostId);
    } catch (error) {
      redirectError(
        `/studio/${draftId}`,
        `HighLevel delete failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
  await db.delete(scheduledPosts).where(eq(scheduledPosts.id, postId));
  redirectSuccess(`/studio/${draftId}`, "Publishing record removed.");
}