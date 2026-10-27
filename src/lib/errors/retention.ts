import "server-only";

import { lt } from "drizzle-orm";
import { getDb } from "@/db";
import { errorEvents } from "@/db/schema";

export async function pruneErrorEvents(days = 90): Promise<number> {
  const retentionDays = Math.min(3650, Math.max(1, Math.floor(days)));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const removed = await getDb()
    .delete(errorEvents)
    .where(lt(errorEvents.occurredAt, cutoff))
    .returning({ id: errorEvents.id });
  return removed.length;
}
