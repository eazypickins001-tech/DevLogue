import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

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

const name = `DevLogue Workflow ${Date.now().toString().slice(-6)}`;
const sessionTitle = "Recorded the media pipeline";
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
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) console.log(`    worker exited with ${code}`);
  });
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
    await page.getByLabel("Short description").fill("Automated workflow project for DevLogue.");
    await page.getByLabel("Problem being solved").fill("Recording, rendering and publishing are split.");
    await page.getByLabel("Target users").fill("Solo software builders.");
    await page.getByLabel("LinkedIn").check();
    await page.getByLabel("Instagram").check();
    await page.getByLabel("Preferred tone").fill("Dry, specific, first person, no hype.");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/);
    projectUrl = page.url();
    await page.getByText("Project created.").waitFor();
  });

  await step("save publishing accounts", async () => {
    await page.getByRole("button", { name: "Load accounts from HighLevel" }).click();
    await page.getByText(/accounts loaded\./).waitFor({ timeout: 60_000 });
    await page.getByPlaceholder("Filter by name or platform").fill("Ai4Beginners");
    const facebook = page
      .locator("li")
      .filter({ hasText: "Ai4Beginners" })
      .filter({ hasText: "PAGE" })
      .first();
    await facebook.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Save \d+ selected/ }).click();
    await page.getByText(/account\(s\) saved\./).waitFor({ timeout: 30_000 });
  });

  await step("create session", async () => {
    const projectId = projectUrl.split("/").pop();
    await page.goto(`${BASE}/sessions/new?projectId=${projectId}`);
    await page.getByLabel("Session title").fill(sessionTitle);
    await page.getByLabel("What did you work on?").fill("Recorded a short camera clip in the app.");
    await page.getByLabel("Problem encountered").fill("The pipeline had no automated coverage.");
    await page.getByLabel("What changed?").fill("Added a workflow smoke that records, renders and drafts.");
    await page.getByLabel("What worked").fill("Camera capture with fake media devices.");
    await page.getByLabel("What failed").fill("Nothing yet.");
    await page.getByLabel("What did you learn?").fill("Headless Chromium can record with fake devices.");
    await page.getByLabel("What remains unfinished?").fill("Production recording length checks.");
    await page.getByLabel("Next task").fill("Publish the rendered draft.");
    await page.getByLabel(/safe to publish/).check();
    await page.getByRole("button", { name: "Save session" }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
    await page.getByText(/Session captured/).waitFor();
  });

  await step("record camera clip", async () => {
    await page.goto(`${BASE}/record`);
    await page.getByRole("button", { name: "Camera only" }).click();
    await page
      .locator("#record-session-destination")
      .selectOption({ label: `${name} - ${sessionTitle}` });
    await page.getByRole("button", { name: "Start recording" }).click();
    await page.waitForTimeout(6_000);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await page.getByRole("heading", { name: "Recording ready" }).waitFor({ timeout: 60_000 });
  });

  await step("upload tracks", async () => {
    await page.getByRole("button", { name: "Save recording" }).click();
    await page.getByText("Saved to the session.").waitFor({ timeout: 180_000 });
    await page.getByRole("link", { name: "Open timeline" }).click();
    await page.waitForURL(/\/timelines\/[0-9a-f-]{36}/);
    timelineId = page.url().split("/").pop();
  });

  await step("queue render", async () => {
    await page.getByRole("button", { name: "Queue final render" }).click();
    await page.getByText("Timeline render").waitFor();
  });

  await step("process render", async () => {
    worker = startWorker();
    await waitForRender(timelineId, 8 * 60_000);
    await page.reload();
    await page.getByText("succeeded", { exact: true }).waitFor({ timeout: 60_000 });
  });

  await step("create content draft", async () => {
    await page.getByRole("button", { name: "Create content draft" }).click();
    await page.waitForURL(/\/studio\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: /Approve version/ }).click();
    await page.locator('[role="status"]').filter({ hasText: "Approved version" }).waitFor();
  });

  await step("verify publishing handoff", async () => {
    const panel = page.locator("#publishing");
    const badge = await panel.getByText(/Test mode|Live mode/).first().innerText();
    if (!badge.includes("Test mode")) {
      await panel.getByRole("button", { name: "Schedule post" }).waitFor();
      console.log("    live mode: handoff verified, nothing published");
      return;
    }
    await panel.getByRole("checkbox").first().check();
    await panel.getByRole("button", { name: "Create HighLevel draft" }).click();
    await page.getByText(/Test mode: nothing was published/).waitFor({ timeout: 120_000 });
    await page.getByText(/Created:/).waitFor();
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
    await page.getByText(/Publishing record removed/).waitFor({ timeout: 60_000 });
  });

  await step("cleanup project", async () => {
    await page.goto(projectUrl);
    await page.locator("#confirmation").fill("DELETE");
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByText(/Project and its sessions were deleted|Project.*deleted/).waitFor();
  });

  console.log("WORKFLOW SMOKE PASSED");
} catch (error) {
  await page.screenshot({ path: ".smoke-workflow-failure.png", fullPage: true }).catch(() => undefined);
  console.log("WORKFLOW SMOKE FAILED:", currentStep, "-", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  worker?.kill();
  await browser.close();
}
