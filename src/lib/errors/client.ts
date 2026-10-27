export type ClientErrorPayload = {
  name?: string;
  message: string;
  stack?: string | null;
  route?: string | null;
  action?: string | null;
  context?: Record<string, unknown> | null;
  userAgent?: string | null;
};

const QUEUE_KEY = "devlogue-error-queue";

function readQueue(): ClientErrorPayload[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: ClientErrorPayload[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-20)));
  } catch {
    // Storage can be unavailable in private modes.
  }
}

async function send(payload: ClientErrorPayload): Promise<boolean> {
  try {
    const response = await fetch("/api/errors/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (response.status === 401) return true;
    return response.ok;
  } catch {
    return false;
  }
}

export function reportClientError(payload: ClientErrorPayload): void {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) {
    writeQueue([...readQueue(), payload]);
    return;
  }
  void send(payload).then((ok) => {
    if (!ok) writeQueue([...readQueue(), payload]);
  });
}

export async function flushClientErrorQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  const items = readQueue();
  if (items.length === 0) return;
  const remaining: ClientErrorPayload[] = [];
  for (const item of items) {
    const ok = await send(item);
    if (!ok) remaining.push(item);
  }
  writeQueue(remaining);
}
