import { spawn } from "node:child_process";
import dns from "node:dns";
import { createServer } from "node:http";
import { appendFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

dns.setDefaultResultOrder("ipv4first");

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.WORKER_CONTROL_PORT || 4100);
const host = process.env.WORKER_CONTROL_HOST || "127.0.0.1";
const token = process.env.WORKER_CONTROL_TOKEN?.trim();
const workerPath = join(root, "scripts", "render-worker.mjs");
const logPath = join(root, ".worker.log");

if (!token) {
  console.error("WORKER_CONTROL_TOKEN is required.");
  process.exit(1);
}

let child = null;
let startedAt = null;
let lastExit = null;
let stopRequested = false;
let restartTimer = null;

function authorized(request) {
  const header = request.headers.authorization || "";
  return header === `Bearer ${token}`;
}

function status() {
  return {
    running: Boolean(child && child.exitCode === null),
    pid: child?.pid ?? null,
    startedAt,
    lastExit,
    log: logPath,
  };
}

async function databaseDiagnostic() {
  const startedAt = Date.now();
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`select now() as now`;
    return { ok: true, ms: Date.now() - startedAt, now: rows[0]?.now ?? null };
  } catch (error) {
    const cause = error && typeof error === "object" ? error.cause : null;
    return {
      ok: false,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      cause:
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : cause
            ? String(cause)
            : null,
    };
  }
}

function logTail(lineCount = 200) {
  if (!existsSync(logPath)) return "";
  return readFileSync(logPath, "utf8").split(/\r?\n/).slice(-lineCount).join("\n");
}

function startWorker() {
  if (child && child.exitCode === null) return { ok: true, alreadyRunning: true, ...status() };
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  stopRequested = false;
  mkdirSync(root, { recursive: true });
  if (!existsSync(logPath)) appendFileSync(logPath, "");
  const logFd = openSync(logPath, "a");
  startedAt = new Date().toISOString();
  lastExit = null;
  child = spawn(process.execPath, [workerPath], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  closeSync(logFd);
  const target = child;
  target.on("exit", (code, signal) => {
    lastExit = { code, signal, at: new Date().toISOString() };
    if (child === target) child = null;
    if (!stopRequested) {
      console.log("worker-control: worker exited; restarting in 5s");
      restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!child) startWorker();
      }, 5000);
      restartTimer.unref();
    }
  });
  return { ok: true, alreadyRunning: false, ...status() };
}

function stopWorker() {
  stopRequested = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (!child || child.exitCode !== null) return { ok: true, alreadyRunning: false, ...status() };
  const target = child;
  const pid = target.pid;
  const killTimer = setTimeout(() => {
    if (target.exitCode === null) target.kill("SIGKILL");
  }, 5000);
  killTimer.unref();
  target.once("exit", () => clearTimeout(killTimer));
  target.kill("SIGTERM");
  return { ok: true, stopping: true, pid, ...status() };
}

const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method === "GET" && request.url === "/health") {
    response.end(JSON.stringify({ ok: true, service: "devlogue-worker-control" }));
    return;
  }
  if (!authorized(request)) {
    response.statusCode = 401;
    response.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    return;
  }
  if (request.method === "GET" && request.url === "/status") {
    response.end(JSON.stringify({ ok: true, ...status() }));
    return;
  }
  if (request.method === "GET" && request.url === "/log") {
    response.end(JSON.stringify({ ok: true, log: logTail() }));
    return;
  }
  if (request.method === "GET" && request.url === "/diag") {
    void databaseDiagnostic().then((result) => {
      response.end(JSON.stringify(result));
    });
    return;
  }
  if (request.method === "POST" && request.url === "/start") {
    response.end(JSON.stringify(startWorker()));
    return;
  }
  if (request.method === "POST" && request.url === "/stop") {
    response.end(JSON.stringify(stopWorker()));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(port, host, () => {
  console.log(`worker-control: listening on http://${host}:${port}`);
  console.log(`worker-control: starting worker on POST /start`);
  if (process.env.WORKER_CONTROL_AUTOSTART === "true") {
    console.log("worker-control: autostart enabled");
    startWorker();
  }
});

process.on("SIGINT", () => {
  stopWorker();
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  stopWorker();
  server.close(() => process.exit(0));
});
