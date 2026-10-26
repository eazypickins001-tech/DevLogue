import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets, mediaDerivativeJobs } from "@/db/schema";

export async function ensureDerivativeJobsForRecording(recordingId: string): Promise<void> {
  const db = getDb();
  const assets = await db
    .select({
      id: mediaAssets.id,
      kind: mediaAssets.kind,
      thumbnailKey: mediaAssets.thumbnailKey,
      waveformKey: mediaAssets.waveformKey,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordingId, recordingId),
        inArray(mediaAssets.kind, ["video", "audio"]),
      ),
    );

  for (const asset of assets) {
    if (asset.thumbnailKey || asset.waveformKey) continue;
    const existing = await db
      .select({ id: mediaDerivativeJobs.id })
      .from(mediaDerivativeJobs)
      .where(eq(mediaDerivativeJobs.mediaAssetId, asset.id))
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(mediaDerivativeJobs).values({ mediaAssetId: asset.id, status: "queued" });
  }
}
