"use server";

import { getDb } from "@/db";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectSuccess } from "@/lib/forms";
import { sql } from "drizzle-orm";

export type WorkerStatus = {
  ok: boolean;
  configured: boolean;
  running: boolean;
  pid?: number | null;
  startedAt?: string | null;
  lastExit?: { code: number | null; signal: string | null; at: string } | null;
  log?: string;
  error?: string;
};

function controlConfig(): { url: string; token: string } | null {
  const url = process.env.WORKER_CONTROL_URL?.trim().replace(/\/+$/, "");
  const token = process.env.WORKER_CONTROL_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

async function requestWorker(path: string, method: "GET" | "POST"): Promise<WorkerStatus> {
  await requireSession();
  const config = controlConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      running: false,
      error: "Worker control is not configured. Add WORKER_CONTROL_URL and WORKER_CONTROL_TOKEN.",
    };
  }
  try {
    const response = await fetch(`${config.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as Omit<WorkerStatus, "configured">;
    return { ...body, configured: true, ok: response.ok && body.ok !== false };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      running: false,
      error: error instanceof Error ? error.message : "Worker control request failed.",
    };
  }
}

export async function getWorkerStatus(): Promise<WorkerStatus> {
  return requestWorker("/status", "GET");
}

export async function startWorker(): Promise<WorkerStatus> {
  return requestWorker("/start", "POST");
}

export async function stopWorker(): Promise<WorkerStatus> {
  return requestWorker("/stop", "POST");
}

export async function retryFailedJobs(): Promise<void> {
  await requireSession();
  const owner = await getOwner();
  const db = getDb();

  const results = await Promise.all([
    db.execute(sql`
      update media_derivative_jobs j
      set status = 'queued', error = null, attempts = 0, updated_at = now()
      from media_assets a
      where a.id = j.media_asset_id and a.user_id = ${owner.id} and j.status = 'failed'
    `),
    db.execute(sql`
      update transcription_jobs j
      set status = 'queued', error = null, attempts = 0, updated_at = now()
      from media_assets a
      where a.id = j.media_asset_id and a.user_id = ${owner.id} and j.status = 'failed'
    `),
    db.execute(sql`
      update timeline_render_jobs j
      set status = 'queued', error = null, attempts = 0, updated_at = now()
      from timeline_projects t
      where t.id = j.timeline_id and t.user_id = ${owner.id} and j.status = 'failed'
    `),
    db.execute(sql`
      update render_jobs j
      set status = 'queued', error = null, attempts = 0, updated_at = now()
      from content_drafts d
      join projects p on p.id = d.project_id
      where d.id = j.draft_id and p.user_id = ${owner.id} and j.status = 'failed'
    `),
  ]);
  const count = results.reduce((total, result) => {
    const rowCount = (result as { rowCount?: number | null }).rowCount;
    return total + (rowCount ?? 0);
  }, 0);

  redirectSuccess(
    "/video",
    count === 0 ? "No failed jobs to retry." : `Requeued ${count} failed job${count === 1 ? "" : "s"}.`,
  );
}