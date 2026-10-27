import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { mediaAssets, multipartUploads } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { deleteObject, isStorageConfigured, listR2Objects } from "@/lib/storage";
import { findOrphanKeys, isAuditedKey } from "@/lib/storage-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PREFIXES = ["media/", "renders/", "derivatives/"];

async function knownKeys(): Promise<Set<string>> {
  const owner = await getOwner();
  const db = getDb();
  const [assets, uploads] = await Promise.all([
    db
      .select({
        storageKey: mediaAssets.storageKey,
        thumbnailKey: mediaAssets.thumbnailKey,
        waveformKey: mediaAssets.waveformKey,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, owner.id)),
    db.select({ key: multipartUploads.key }).from(multipartUploads).where(eq(multipartUploads.userId, owner.id)),
  ]);
  const keys = new Set<string>();
  for (const asset of assets) {
    for (const key of [asset.storageKey, asset.thumbnailKey, asset.waveformKey]) {
      if (key) keys.add(key);
    }
  }
  for (const upload of uploads) keys.add(upload.key);
  return keys;
}

export async function GET(): Promise<Response> {
  await requireSession();
  if (!isStorageConfigured()) {
    return NextResponse.json({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }
  try {
    const [known, pages] = await Promise.all([
      knownKeys(),
      Promise.all(PREFIXES.map((prefix) => listR2Objects(prefix))),
    ]);
    const objects = pages.flat();
    const orphans = findOrphanKeys(objects, known);
    return NextResponse.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      objectCount: objects.length,
      objectBytes: objects.reduce((total, object) => total + object.size, 0),
      knownCount: known.size,
      orphanCount: orphans.length,
      orphanBytes: orphans.reduce((total, object) => total + object.size, 0),
      orphans: orphans.slice(0, 1000),
      truncated: orphans.length > 1000,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Storage scan failed." },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({ keys: z.array(z.string().min(1).max(1024)).max(2000) });

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
    return NextResponse.json({ ok: false, error: "Invalid key list." }, { status: 422 });
  }
  const known = await knownKeys();
  const keys = parsed.data.keys.filter((key) => isAuditedKey(key) && !known.has(key));
  const deleted: string[] = [];
  const errors: { key: string; error: string }[] = [];
  for (const key of keys) {
    try {
      await deleteObject(key);
      deleted.push(key);
    } catch (error) {
      errors.push({ key, error: error instanceof Error ? error.message : "Delete failed." });
    }
  }
  return NextResponse.json({ ok: errors.length === 0, deleted: deleted.length, errors });
}
