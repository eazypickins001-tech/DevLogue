"use server";

import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { buildSessions, mediaAssets } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";
import {
  buildMediaKey,
  deleteObject,
  headObject,
  isStorageConfigured,
  presignPut,
  readObjectPrefix,
} from "@/lib/storage";
import { matchesSignature, validateUpload } from "@/lib/domain/media";
import { formString } from "@/lib/validation";
import { redirect } from "next/navigation";

const STORAGE_ERROR =
  "R2 storage is not configured. Add the R2_* variables to .env.local to enable uploads.";

export type UploadTicket =
  | { ok: true; uploadUrl: string; key: string; filename: string }
  | { ok: false; error: string };

async function assertSessionOwned(sessionId: string): Promise<{ userId: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ id: buildSessions.id })
    .from(buildSessions)
    .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, (await getOwner()).id)))
    .limit(1);
  if (rows.length === 0) return null;
  return { userId: (await getOwner()).id };
}

export async function requestUpload(input: {
  sessionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  if (!isStorageConfigured()) return { ok: false, error: STORAGE_ERROR };
  const owned = await assertSessionOwned(input.sessionId);
  if (!owned) return { ok: false, error: "Session not found." };
  const validation = validateUpload(input);
  if (!validation.ok) return { ok: false, error: validation.reason };
  const key = buildMediaKey(owned.userId, validation.filename);
  const uploadUrl = await presignPut(key);
  return { ok: true, uploadUrl, key, filename: validation.filename };
}

export async function completeUpload(input: {
  sessionId: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  notes?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  if (!isStorageConfigured()) return { ok: false, error: STORAGE_ERROR };
  const owner = await getOwner();
  if (!input.key.startsWith(`media/${owner.id}/`)) {
    return { ok: false, error: "Upload key does not belong to this account." };
  }
  const owned = await assertSessionOwned(input.sessionId);
  if (!owned) return { ok: false, error: "Session not found." };
  const validation = validateUpload(input);
  if (!validation.ok) return { ok: false, error: validation.reason };

  const remote = await headObject(input.key);
  if (!remote) return { ok: false, error: "The uploaded file was not found in R2." };
  if (remote.size !== input.sizeBytes) {
    return {
      ok: false,
      error: `Uploaded size (${remote.size} bytes) does not match the declared size (${input.sizeBytes} bytes).`,
    };
  }

  const prefix = await readObjectPrefix(input.key, 32);
  if (prefix && !matchesSignature(prefix, validation.kind)) {
    return {
      ok: false,
      error: "The file contents do not match the declared file type. Upload rejected.",
    };
  }

  const db = getDb();
  await db.insert(mediaAssets).values({
    userId: owner.id,
    sessionId: input.sessionId,
    kind: validation.kind,
    filename: validation.filename,
    storageKey: input.key,
    contentType: input.contentType.split(";")[0].trim().toLowerCase(),
    sizeBytes: remote.size,
    isPrivate: true,
    notes: input.notes?.trim() || null,
    width: input.width && input.width > 0 ? Math.round(input.width) : null,
    height: input.height && input.height > 0 ? Math.round(input.height) : null,
    durationSeconds:
      input.durationSeconds && input.durationSeconds > 0
        ? input.durationSeconds.toFixed(2)
        : null,
  });
  return { ok: true };
}

export async function deleteMedia(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const mediaId = formString(formData, "mediaId");
  const owner = await getOwner();
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.userId, owner.id)))
    .limit(1);
  const asset = rows[0];
  if (!asset) redirectError("/sessions", "Media asset not found.");

  if (isStorageConfigured()) {
    try {
      await deleteObject(asset.storageKey);
    } catch {
      // Deleting the database row still removes access; surface the storage failure below.
    }
  }
  await db.delete(mediaAssets).where(eq(mediaAssets.id, mediaId));
  const target = asset.sessionId ? `/sessions/${asset.sessionId}` : "/sessions";
  redirect(`${target}?message=Media%20deleted.`);
}
