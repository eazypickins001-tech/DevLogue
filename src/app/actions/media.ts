"use server";

import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  buildSessions,
  mediaAssets,
  mediaDerivativeJobs,
  multipartUploads,
} from "@/db/schema";
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
import { matchesSignature, safeFilename, validateUpload } from "@/lib/domain/media";
import {
  MULTIPART_PART_SIZE,
  MULTIPART_THRESHOLD,
  abortMultipartUpload as abortR2Multipart,
  completeMultipartUpload as completeR2Multipart,
  createMultipartUpload,
  listMultipartParts,
  partCountFor,
  presignUploadPart,
} from "@/lib/storage-multipart";
import { formString } from "@/lib/validation";
import { redirect } from "next/navigation";

const STORAGE_ERROR =
  "R2 storage is not configured. Add the R2_* variables to .env.local to enable uploads.";

export type MultipartPartUrl = { partNumber: number; url: string };

export type UploadTicket =
  | { ok: true; mode: "single"; uploadUrl: string; key: string; filename: string }
  | {
      ok: true;
      mode: "multipart";
      uploadId: string;
      key: string;
      filename: string;
      partSize: number;
      parts: MultipartPartUrl[];
      completedParts?: number[];
    }
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
  const owner = await getOwner();
  const owned = await assertSessionOwned(input.sessionId);
  if (!owned) return { ok: false, error: "Session not found." };
  const validation = validateUpload(input);
  if (!validation.ok) return { ok: false, error: validation.reason };
  const key = buildMediaKey(owned.userId, validation.filename);
  const contentType = input.contentType.split(";")[0].trim().toLowerCase();

  if (input.sizeBytes <= MULTIPART_THRESHOLD) {
    const uploadUrl = await presignPut(key);
    return { ok: true, mode: "single", uploadUrl, key, filename: validation.filename };
  }

  const partSize = MULTIPART_PART_SIZE;
  const partCount = partCountFor(input.sizeBytes, partSize);
  if (partCount === 0 || partCount > 10000) {
    return { ok: false, error: "The file is too large for a multipart upload." };
  }

  let storageUploadId: string;
  try {
    storageUploadId = await createMultipartUpload(key, contentType);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not start the multipart upload.",
    };
  }

  const inserted = await getDb()
    .insert(multipartUploads)
    .values({
      userId: owner.id,
      sessionId: input.sessionId,
      key,
      uploadId: storageUploadId,
      filename: validation.filename,
      contentType,
      sizeBytes: input.sizeBytes,
      partSize,
      partCount,
      status: "uploading",
    })
    .returning({ id: multipartUploads.id });
  const upload = inserted[0];
  if (!upload) {
    await abortR2Multipart(key, storageUploadId).catch(() => undefined);
    return { ok: false, error: "Could not record the multipart upload." };
  }

  let parts: MultipartPartUrl[];
  try {
    parts = await Promise.all(
      Array.from({ length: partCount }, async (_, index) => {
        const partNumber = index + 1;
        return {
          partNumber,
          url: await presignUploadPart(key, storageUploadId, partNumber),
        };
      }),
    );
  } catch (error) {
    await abortR2Multipart(key, storageUploadId).catch(() => undefined);
    await getDb()
      .update(multipartUploads)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(multipartUploads.id, upload.id));
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not sign the upload parts.",
    };
  }

  return {
    ok: true,
    mode: "multipart",
    uploadId: upload.id,
    key,
    filename: validation.filename,
    partSize,
    parts,
  };
}
export async function resumeMultipartUpload(input: {
  uploadId: string;
  sessionId: string;
  filename: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  if (!isStorageConfigured()) return { ok: false, error: STORAGE_ERROR };
  const owner = await getOwner();
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "File size is missing or invalid." };
  }
  const filename = safeFilename(input.filename);

  const rows = await getDb()
    .select()
    .from(multipartUploads)
    .where(
      and(
        eq(multipartUploads.id, input.uploadId),
        eq(multipartUploads.userId, owner.id),
        eq(multipartUploads.sessionId, input.sessionId),
        eq(multipartUploads.status, "uploading"),
      ),
    )
    .limit(1);
  const upload = rows[0];
  if (!upload) return { ok: false, error: "Pending upload not found." };
  if (upload.filename !== filename || upload.sizeBytes !== input.sizeBytes) {
    return { ok: false, error: "Choose the original file to resume this upload." };
  }

  let completedParts: number[] = [];
  try {
    const parts = await listMultipartParts(upload.key, upload.uploadId);
    completedParts = parts.map((part) => part.partNumber);
  } catch (error) {
    await getDb()
      .update(multipartUploads)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(multipartUploads.id, upload.id));
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not inspect the pending upload.",
    };
  }

  let parts: MultipartPartUrl[];
  try {
    parts = await Promise.all(
      Array.from({ length: upload.partCount }, async (_, index) => {
        const partNumber = index + 1;
        return {
          partNumber,
          url: await presignUploadPart(upload.key, upload.uploadId, partNumber),
        };
      }),
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not sign the upload parts.",
    };
  }

  return {
    ok: true,
    mode: "multipart",
    uploadId: upload.id,
    key: upload.key,
    filename: upload.filename,
    partSize: upload.partSize,
    parts,
    completedParts,
  };
}
export type CompleteUploadResult =
  | { ok: true; assetId: string }
  | { ok: false; error: string };

type AssetRegistration = {
  ownerId: string;
  sessionId: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  notes?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

async function registerUploadedAsset(input: AssetRegistration): Promise<CompleteUploadResult> {
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

  const inserted = await getDb()
    .insert(mediaAssets)
    .values({
      userId: input.ownerId,
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
    })
    .returning({ id: mediaAssets.id });
  const assetId = inserted[0].id;
  if (validation.kind === "video" || validation.kind === "audio") {
    await getDb()
      .insert(mediaDerivativeJobs)
      .values({ mediaAssetId: assetId, status: "queued" });
  }
  return { ok: true, assetId };
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
}): Promise<CompleteUploadResult> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  if (!isStorageConfigured()) return { ok: false, error: STORAGE_ERROR };
  const owner = await getOwner();
  if (!input.key.startsWith(`media/${owner.id}/`)) {
    return { ok: false, error: "Upload key does not belong to this account." };
  }
  const owned = await assertSessionOwned(input.sessionId);
  if (!owned) return { ok: false, error: "Session not found." };
  return registerUploadedAsset({ ...input, ownerId: owner.id });
}

export async function completeMultipartUpload(input: {
  uploadId: string;
  sessionId: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  notes?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}): Promise<CompleteUploadResult> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  if (!isStorageConfigured()) return { ok: false, error: STORAGE_ERROR };
  const owner = await getOwner();
  const owned = await assertSessionOwned(input.sessionId);
  if (!owned) return { ok: false, error: "Session not found." };

  const rows = await getDb()
    .select()
    .from(multipartUploads)
    .where(
      and(
        eq(multipartUploads.id, input.uploadId),
        eq(multipartUploads.userId, owner.id),
        eq(multipartUploads.sessionId, input.sessionId),
        eq(multipartUploads.key, input.key),
      ),
    )
    .limit(1);
  const upload = rows[0];
  if (!upload) return { ok: false, error: "Multipart upload not found." };
  if (upload.status !== "uploading") return { ok: false, error: "This upload is no longer active." };

  try {
    const parts = await listMultipartParts(upload.key, upload.uploadId);
    if (parts.length !== upload.partCount) {
      return {
        ok: false,
        error: `R2 has ${parts.length} of ${upload.partCount} parts. Retry the remaining parts.`,
      };
    }
    const uploadedBytes = parts.reduce((sum, part) => sum + part.size, 0);
    if (uploadedBytes !== upload.sizeBytes) {
      return {
        ok: false,
        error: `R2 has ${uploadedBytes} bytes, expected ${upload.sizeBytes}.`,
      };
    }
    parts.sort((a, b) => a.partNumber - b.partNumber);
    await completeR2Multipart(upload.key, upload.uploadId, parts);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not complete the multipart upload.",
    };
  }

  const result = await registerUploadedAsset({
    ownerId: owner.id,
    sessionId: input.sessionId,
    key: upload.key,
    filename: upload.filename,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
    notes: input.notes,
    width: input.width,
    height: input.height,
    durationSeconds: input.durationSeconds,
  });
  if (!result.ok) {
    await getDb()
      .update(multipartUploads)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(multipartUploads.id, upload.id));
    await deleteObject(upload.key).catch(() => undefined);
    return result;
  }

  await getDb()
    .update(multipartUploads)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(multipartUploads.id, upload.id));
  return result;
}

export async function abortMultipartUpload(input: {
  uploadId: string;
  sessionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  if (!isStorageConfigured()) return { ok: false, error: STORAGE_ERROR };
  const owner = await getOwner();
  const rows = await getDb()
    .select()
    .from(multipartUploads)
    .where(
      and(
        eq(multipartUploads.id, input.uploadId),
        eq(multipartUploads.userId, owner.id),
        eq(multipartUploads.sessionId, input.sessionId),
      ),
    )
    .limit(1);
  const upload = rows[0];
  if (!upload) return { ok: false, error: "Multipart upload not found." };
  try {
    await abortR2Multipart(upload.key, upload.uploadId);
  } catch {
    // The database record is still marked aborted so it cannot be completed later.
  }
  await getDb()
    .update(multipartUploads)
    .set({ status: "aborted", updatedAt: new Date() })
    .where(eq(multipartUploads.id, upload.id));
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
    for (const key of [asset.storageKey, asset.thumbnailKey, asset.waveformKey].filter((key): key is string => Boolean(key))) {
      try {
        await deleteObject(key);
      } catch {
        // Deleting the database row still removes access; surface the storage failure below.
      }
    }
  }
  await db.delete(mediaAssets).where(eq(mediaAssets.id, mediaId));
  const target = asset.sessionId ? `/sessions/${asset.sessionId}` : "/sessions";
  redirect(`${target}?message=Media%20deleted.`);
}
