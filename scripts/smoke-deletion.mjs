import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";
import { AwsClient } from "aws4fetch";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

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
const password = env.get("APP_PASSWORD");
if (!password) throw new Error("APP_PASSWORD is missing from .env.local");
const databaseUrl = env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is missing from .env.local");
const sql = neon(databaseUrl);

const accountId = env.get("R2_ACCOUNT_ID");
const accessKeyId = env.get("R2_ACCESS_KEY_ID");
const secretAccessKey = env.get("R2_SECRET_ACCESS_KEY");
const bucket = env.get("R2_BUCKET");
if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("R2 is not configured in .env.local");
}
const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

async function objectExists(key) {
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const signed = await r2.sign(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encoded}`,
    { method: "HEAD" },
  );
  const response = await fetch(signed.url, { method: "HEAD", headers: signed.headers });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`HEAD ${key} returned ${response.status}.`);
  return true;
}

const name = `DevLogue Deletion ${Date.now().toString().slice(-6)}`;
const sessionTitle = "Deleted a timeline and a project";
const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 1360, height: 900 },
  permissions: ["camera", "microphone"],
});
const page = await context.newPage();
page.setDefaultTimeout(45_000);
page.on("dialog", (dialog) => void dialog.accept());

let projectUrl = "";
let sessionId = "";
let timelineId = "";
let worker = null;
let currentStep = "startup";

async function step(label, fn) {
  currentStep = label;
  process.stdout.write(`- ${label}… `);
  await fn();
  console.log("ok");
}

async function waitForRender(timeline, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await sql`
      select status, error from timeline_render_jobs
      where timeline_id = ${timeline}
      order by created_at desc
      limit 1
    `;
    const job = rows[0];
    if (job?.status === "succeeded") return;
    if (job?.status === "failed") throw new Error(`Render failed: ${job.error ?? "unknown"}`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("Timed out waiting for the timeline render.");
}

function startWorker() {
  const child = spawn(process.execPath, ["scripts/render-worker.mjs"], {
    env: { ...process.env, ...Object.fromEntries(env) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`    worker: ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`    worker: ${chunk}`));
  return child;
}

try {
  await step("login", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Enter DevLogue" }).click();
    await page.waitForURL("**/dashboard");
  });

  await step("create project", async () => {
    await page.goto(`${BASE}/projects/new`);
    await page.getByLabel("Project name").fill(name);
    await page.getByLabel("Short description").fill("Automated deletion project for DevLogue.");
    await page.getByLabel("Problem being solved").fill("Deleted storage can linger.");
    await page.getByLabel("Target users").fill("Solo software builders.");
    await page.getByLabel("LinkedIn").check();
    await page.getByLabel("Preferred tone").fill("Dry, specific, first person, no hype.");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/);
    projectUrl = page.url();
    await page.getByText("Project created.").waitFor();
  });

  await step("create session", async () => {
    const projectId = projectUrl.split("/").pop();
    await page.goto(`${BASE}/sessions/new?projectId=${projectId}`);
    await page.getByLabel("Session title").fill(sessionTitle);
    await page.getByLabel("What did you work on?").fill("Recorded a short clip for deletion testing.");
    await page.getByLabel("Problem encountered").fill("Deleting a project should remove its objects.");
    await page.getByLabel("What changed?").fill("Added a deletion smoke with R2 checks.");
    await page.getByLabel("What worked").fill("Timeline deletion kept the raw tracks.");
    await page.getByLabel("What failed").fill("Nothing yet.");
    await page.getByLabel("What did you learn?").fill("R2 HEAD is a reliable existence check.");
    await page.getByLabel("What remains unfinished?").fill("Nothing.");
    await page.getByLabel("Next task").fill("Verify object cleanup.");
    await page.getByRole("button", { name: "Save session" }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
    sessionId = page.url().split("?")[0].split("/").pop();
  });

  await step("record camera clip", async () => {
    await page.goto(`${BASE}/record`);
    await page.getByRole("button", { name: "Camera only" }).click();
    await page
      .locator("#record-session-destination")
      .selectOption({ label: `${name} - ${sessionTitle}` });
    await page.getByRole("button", { name: "Start recording" }).click();
    await page.waitForTimeout(5_000);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await page.getByRole("heading", { name: "Recording ready" }).waitFor({ timeout: 60_000 });
  });

  await step("upload tracks", async () => {
    await page.getByRole("button", { name: "Save recording" }).click();
    await page.getByText("Saved to the session.").waitFor({ timeout: 180_000 });
    await page.getByRole("link", { name: "Open timeline" }).click();
    await page.waitForURL(/\/timelines\/[0-9a-f-]{36}/);
    timelineId = page.url().split("?")[0].split("/").pop();
  });

  await step("render timeline", async () => {
    await page.getByRole("button", { name: "Queue final render" }).click();
    await page.getByText("Timeline render").waitFor();
    worker = startWorker();
    await waitForRender(timelineId, 8 * 60_000);
    await page.reload();
    await page.getByText("succeeded", { exact: true }).waitFor({ timeout: 60_000 });
  });

  let rawKeys = [];
  let renderKey = "";
  await step("collect storage keys", async () => {
    const assets = await sql`
      select storage_key, recording_track from media_assets where session_id = ${sessionId}
    `;
    rawKeys = assets
      .filter((asset) => asset.recording_track !== "render")
      .map((asset) => asset.storage_key);
    const jobs = await sql`
      select output_key from timeline_render_jobs where timeline_id = ${timelineId}
    `;
    renderKey = jobs[0]?.output_key ?? "";
    if (rawKeys.length < 2) throw new Error(`Expected raw tracks, found ${rawKeys.length}.`);
    if (!renderKey) throw new Error("The render has no output key.");
    for (const key of [...rawKeys, renderKey]) {
      if (!(await objectExists(key))) throw new Error(`Expected ${key} in R2.`);
    }
  });

  await step("delete timeline", async () => {
    await page.getByRole("button", { name: "Delete timeline" }).click();
    await page.getByText(/Timeline and rendered video deleted/).waitFor({ timeout: 60_000 });
    const timelines = await sql`select id from timeline_projects where id = ${timelineId}`;
    const jobs = await sql`select id from timeline_render_jobs where timeline_id = ${timelineId}`;
    const assets = await sql`
      select storage_key from media_assets where session_id = ${sessionId}
    `;
    if (timelines.length > 0 || jobs.length > 0) throw new Error("Timeline rows survived deletion.");
    if (assets.some((asset) => asset.storage_key === renderKey)) {
      throw new Error("The rendered asset row survived timeline deletion.");
    }
    if (await objectExists(renderKey)) throw new Error("The rendered video is still in R2.");
    for (const key of rawKeys) {
      if (!(await objectExists(key))) throw new Error(`Raw track ${key} was deleted with the timeline.`);
    }
  });

  await step("keep raw tracks in session", async () => {
    await page.goto(`${BASE}/sessions/${sessionId}`);
    for (const key of rawKeys) {
      const filename = key.split("/").pop();
      await page.getByText(filename, { exact: false }).first().waitFor();
    }
  });

  await step("delete project", async () => {
    await page.goto(projectUrl);
    await page.locator("#confirmation").fill("DELETE");
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByText(/Project and all related storage were deleted/).waitFor({ timeout: 60_000 });
    for (const key of rawKeys) {
      if (await objectExists(key)) throw new Error(`Raw track ${key} survived project deletion.`);
    }
    const sessions = await sql`select id from build_sessions where id = ${sessionId}`;
    const assets = await sql`select id from media_assets where session_id = ${sessionId}`;
    if (sessions.length > 0 || assets.length > 0) {
      throw new Error("Session or asset rows survived project deletion.");
    }
  });

  console.log("DELETION SMOKE PASSED");
} catch (error) {
  await page.screenshot({ path: ".smoke-deletion-failure.png", fullPage: true }).catch(() => undefined);
  console.log("DELETION SMOKE FAILED:", currentStep, "-", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  worker?.kill();
  await browser.close();
}
