import "server-only";

export type WorkerSnapshot = {
  configured: boolean;
  state: "running" | "stopped" | "offline" | "unconfigured";
  pid?: number | null;
  detail?: string;
};

function controlConfig(): { url: string; token: string } | null {
  const url = process.env.WORKER_CONTROL_URL?.trim().replace(/\/+$/, "");
  const token = process.env.WORKER_CONTROL_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

export async function getWorkerSnapshot(): Promise<WorkerSnapshot> {
  const config = controlConfig();
  if (!config) return { configured: false, state: "unconfigured" };

  try {
    const response = await fetch(`${config.url}/status`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return { configured: true, state: "offline", detail: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { running?: boolean; pid?: number | null };
    return {
      configured: true,
      state: body.running ? "running" : "stopped",
      pid: body.pid ?? null,
    };
  } catch (error) {
    return {
      configured: true,
      state: "offline",
      detail: error instanceof Error ? error.message : "Worker control request failed.",
    };
  }
}
