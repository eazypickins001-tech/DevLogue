import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

function envLocal() {
  const map = new Map();
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    map.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }
  return map;
}

const env = envLocal();
if (!env.get("DATABASE_URL")) throw new Error("DATABASE_URL is missing from .env.local");

const port = 4199;
const base = `http://127.0.0.1:${port}`;
const token = randomUUID();

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function waitFor(check, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function request(path, { method = "GET", auth = true } = {}) {
  const headers = auth ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${base}${path}`, { method, headers });
  return { status: response.status, body: await response.json().catch(() => null) };
}

let currentStep = "startup";

async function step(label, fn) {
  currentStep = label;
  process.stdout.write(`- ${label}… `);
  await fn();
  console.log("ok");
}

const service = spawn(process.execPath, ["scripts/worker-control.mjs"], {
  env: {
    ...process.env,
    ...Object.fromEntries(env),
    WORKER_CONTROL_HOST: "127.0.0.1",
    WORKER_CONTROL_PORT: String(port),
    WORKER_CONTROL_TOKEN: token,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
service.stdout.on("data", (chunk) => process.stdout.write(`    control: ${chunk}`));
service.stderr.on("data", (chunk) => process.stderr.write(`    control: ${chunk}`));

try {
  await step("service starts", async () => {
    await waitFor(async () => (await request("/health", { auth: false })).status === 200, "health");
  });

  await step("rejects unauthenticated requests", async () => {
    const status = await request("/status", { auth: false });
    if (status.status !== 401) throw new Error(`Expected 401, got ${status.status}.`);
  });

  await step("reports stopped", async () => {
    const status = await request("/status");
    if (!status.body?.ok || status.body.running) {
      throw new Error(`Expected a stopped worker, got ${JSON.stringify(status.body)}.`);
    }
  });

  let workerPid = null;
  await step("starts the worker", async () => {
    const started = await request("/start", { method: "POST" });
    if (!started.body?.running || !started.body.pid) {
      throw new Error(`Start failed: ${JSON.stringify(started.body)}.`);
    }
    workerPid = started.body.pid;
    await waitFor(async () => {
      const status = await request("/status");
      return status.body?.running === true;
    }, "worker to run");
    const again = await request("/start", { method: "POST" });
    if (!again.body?.alreadyRunning) throw new Error("Start was not idempotent.");
  });

  await step("exposes the worker log", async () => {
    await waitFor(async () => {
      const log = await request("/log");
      return Boolean(log.body?.log?.includes("worker:"));
    }, "worker log output", 20_000);
  });

  await step("reports database health", async () => {
    const diag = await request("/diag");
    if (!diag.body?.ok) throw new Error(`Database diagnostic failed: ${JSON.stringify(diag.body)}.`);
  });

  await step("stops the worker", async () => {
    const stopped = await request("/stop", { method: "POST" });
    if (!stopped.body?.ok) throw new Error(`Stop failed: ${JSON.stringify(stopped.body)}.`);
    await waitFor(async () => {
      const status = await request("/status");
      return status.body?.running === false;
    }, "worker to exit");
    if (workerPid) {
      try {
        process.kill(workerPid, 0);
        throw new Error("The worker process is still alive.");
      } catch (error) {
        if (error instanceof Error && error.message.includes("still alive")) throw error;
      }
    }
  });

  console.log("WORKER CONTROL SMOKE PASSED");
} catch (error) {
  console.log("WORKER CONTROL SMOKE FAILED:", currentStep, "-", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await request("/stop", { method: "POST" }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  killTree(service);
}
