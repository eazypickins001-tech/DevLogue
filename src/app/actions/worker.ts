"use server";

import { requireSession } from "@/lib/auth";

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
