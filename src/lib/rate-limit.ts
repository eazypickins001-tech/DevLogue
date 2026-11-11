import { neon } from "@neondatabase/serverless";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let client: ReturnType<typeof neon> | null = null;

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  client ??= neon(url);
  return client;
}

export async function checkRateLimit(
  key: string,
  limit = 8,
  windowMs = 10 * 60 * 1000,
): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    return memoryRateLimit(key, limit, windowMs);
  }
  const sql = database();
  if (!sql) return memoryRateLimit(key, limit, windowMs);
  try {
    const resetAt = new Date(Date.now() + windowMs);
    const rows = (await sql`
      insert into rate_limits ("key", count, reset_at, updated_at)
      values (${key}, 1, ${resetAt}, now())
      on conflict ("key") do update
        set count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
            reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end,
            updated_at = now()
      returning count
    `) as unknown as Array<{ count: number | string }>;
    const count = Number(rows[0]?.count ?? 1);
    return count <= limit;
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export async function pruneRateLimits(olderThanDays = 1): Promise<number> {
  const sql = database();
  if (!sql) return 0;
  try {
    const rows = (await sql`
      delete from rate_limits
      where reset_at < now() - make_interval(days => ${olderThanDays})
      returning 1
    `) as unknown as unknown[];
    return rows.length;
  } catch {
    return 0;
  }
}
