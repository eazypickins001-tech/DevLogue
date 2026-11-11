import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";
import { pruneErrorEvents } from "@/lib/errors/retention";
import { pruneRateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const scheduled = Boolean(secret && authorization === `Bearer ${secret}`);
  if (!scheduled && !(await hasSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const days = Number(process.env.ERROR_EVENT_RETENTION_DAYS ?? 90);
  const [deleted, rateLimitsDeleted] = await Promise.all([
    pruneErrorEvents(Number.isFinite(days) ? days : 90),
    pruneRateLimits(),
  ]);
  return NextResponse.json({ ok: true, deleted, rateLimitsDeleted, retentionDays: days });
}
