import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { appendFileSync, existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.WORKER_CONTROL_PORT || 4100);
const host = process.env.WORKER_CONTROL_HOST || "0.0.0.0";
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

function startWorker() {
  if (child && child.exitCode === null) return { ok: true, alreadyRunning: true, ...status() };
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
  child.on("exit", (code, signal) => {
    lastExit = { code, signal, at: new Date().toISOString() };
    child = null;
  });
  return { ok: true, alreadyRunning: false, ...status() };
}

function stopWorker() {
  if (!child || child.exitCode !== null) return { ok: true, alreadyRunning: false, ...status() };
  const pid = child.pid;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child && child.exitCode === null) child.kill("SIGKILL");
  }, 5000).unref();
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
});

process.on("SIGINT", () => {
  stopWorker();
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  stopWorker();
  server.close(() => process.exit(0));
});
