import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { listRetentionCandidates } from "@/lib/queries";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { mediaRetentionDays, retentionCutoff } from "@/lib/storage-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  await requireSession();
  const owner = await getOwner();
  const days = mediaRetentionDays();
  const cutoff = retentionCutoff(days);
  const candidates = await listRetentionCandidates(owner.id, cutoff);
  const byProject = new Map<string, { name: string; bytes: number; count: number }>();
  for (const candidate of candidates) {
    const name = candidate.projectName ?? "Unassigned";
    const row = byProject.get(name) ?? { name, bytes: 0, count: 0 };
    row.bytes += candidate.sizeBytes;
    row.count += 1;
    byProject.set(name, row);
  }
  return NextResponse.json({
    ok: true,
    days,
    cutoff: cutoff.toISOString(),
    assetCount: candidates.length,
    bytes: candidates.reduce((total, candidate) => total + candidate.sizeBytes, 0),
    byProject: [...byProject.values()].sort((a, b) => b.bytes - a.bytes),
    assets: candidates.map(({ storageKey, thumbnailKey, waveformKey, ...candidate }) => candidate),
  });
}

const deleteSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(500),
  confirmation: z.literal("DELETE"),
});

export async function POST(request: Request): Promise<Response> {
  await requireSession();
  if (!isStorageConfigured()) {
    return NextResponse.json({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Type DELETE to confirm." }, { status: 422 });
  }

  const owner = await getOwner();
  const candidates = await listRetentionCandidates(owner.id, retentionCutoff(mediaRetentionDays()));
  const wanted = new Set(parsed.data.assetIds);
  const assets = candidates.filter((candidate) => wanted.has(candidate.id));
  const deleted: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const asset of assets) {
    const keys = [asset.storageKey, asset.thumbnailKey, asset.waveformKey].filter(
      (key): key is string => Boolean(key),
    );
    let failed = false;
    for (const key of keys) {
      try {
        await deleteObject(key);
      } catch (error) {
        failed = true;
        errors.push({
          id: asset.id,
          error: `${key}: ${error instanceof Error ? error.message : "Delete failed."}`,
        });
      }
    }
    if (failed) continue;
    try {
      await getDb()
        .delete(mediaAssets)
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.userId, owner.id)));
      deleted.push(asset.id);
    } catch (error) {
      errors.push({
        id: asset.id,
        error: error instanceof Error ? error.message : "Database delete failed.",
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    deleted: deleted.length,
    skipped: parsed.data.assetIds.length - assets.length,
    errors,
  });
}
