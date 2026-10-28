import { readFileSync, statSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const MULTIPART_MIN_BYTES = 17 * 1024 * 1024;

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

const fixtureDir = join(tmpdir(), "devlogue-multipart");
const fixture = join(fixtureDir, "multipart-test.mp4");

function buildFixture() {
  mkdirSync(fixtureDir, { recursive: true });
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=1920x1080:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440",
      "-t",
      "20",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-b:v",
      "15M",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      fixture,
    ],
    { stdio: "ignore" },
  );
  if (result.status !== 0) throw new Error("ffmpeg could not build the multipart fixture.");
  const size = statSync(fixture).size;
  if (size < MULTIPART_MIN_BYTES) {
    throw new Error(`Fixture is ${size} bytes; multipart needs at least ${MULTIPART_MIN_BYTES}.`);
  }
  return size;
}

const name = `DevLogue Multipart ${Date.now().toString().slice(-6)}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.setDefaultTimeout(45_000);
page.on("dialog", (dialog) => void dialog.accept());

let projectUrl = "";
let sessionId = "";
let currentStep = "startup";

async function step(label, fn) {
  currentStep = label;
  process.stdout.write(`- ${label}… `);
  await fn();
  console.log("ok");
}

try {
  let fixtureSize = 0;
  await step("prepare fixture", async () => {
    fixtureSize = buildFixture();
  });

  await step("login", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Enter DevLogue" }).click();
    await page.waitForURL("**/dashboard");
  });

  await step("create project", async () => {
    await page.goto(`${BASE}/projects/new`);
    await page.getByLabel("Project name").fill(name);
    await page.getByLabel("Short description").fill("Automated multipart project for DevLogue.");
    await page.getByLabel("Problem being solved").fill("Large uploads can be interrupted.");
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
    await page.getByLabel("Session title").fill("Interrupted a large upload");
    await page.getByLabel("What did you work on?").fill("Uploaded a large video file.");
    await page.getByLabel("Problem encountered").fill("The upload was interrupted.");
    await page.getByLabel("What changed?").fill("Resumed from the uploaded parts.");
    await page.getByLabel("What worked").fill("Resume completed the upload.");
    await page.getByLabel("What failed").fill("The first attempt was cut off.");
    await page.getByLabel("What did you learn?").fill("Parts persist across reloads.");
    await page.getByLabel("What remains unfinished?").fill("Nothing.");
    await page.getByLabel("Next task").fill("Verify the asset.");
    await page.getByRole("button", { name: "Save session" }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
    sessionId = page.url().split("?")[0].split("/").pop();
  });

  await step("interrupt upload", async () => {
    await page.locator("#media-file").setInputFiles(fixture);
    await page.getByText(/Uploading .*\(/).waitFor({ timeout: 60_000 });
    await page.reload();
    await page.getByText("Interrupted uploads").waitFor({ timeout: 60_000 });
    await page.getByText("multipart-test.mp4").waitFor();
  });

  await step("resume upload", async () => {
    const rows = await sql`
      select id, status, part_count from multipart_uploads
      where session_id = ${sessionId} and filename = 'multipart-test.mp4'
      order by created_at desc
      limit 1
    `;
    const pending = rows[0];
    if (!pending || pending.status !== "uploading") {
      throw new Error("No pending multipart upload was recorded.");
    }
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Resume" }).first().click();
    const chooser = await chooserPromise;
    await chooser.setFiles(fixture);
    await page.getByText("Interrupted uploads").waitFor({ state: "hidden", timeout: 5 * 60_000 });
    await page.getByText("multipart-test.mp4").waitFor({ timeout: 60_000 });
  });

  await step("verify asset", async () => {
    const assets = await sql`
      select id, size_bytes, storage_key from media_assets
      where session_id = ${sessionId} and filename = 'multipart-test.mp4'
    `;
    if (assets.length !== 1) throw new Error(`Expected one asset, found ${assets.length}.`);
    if (Number(assets[0].size_bytes) !== fixtureSize) {
      throw new Error(`Asset is ${assets[0].size_bytes} bytes, expected ${fixtureSize}.`);
    }
    const pending = await sql`
      select status from multipart_uploads where session_id = ${sessionId}
    `;
    if (pending.some((row) => row.status !== "completed")) {
      throw new Error("A multipart upload record did not complete.");
    }
  });

  await step("cleanup project", async () => {
    await page.goto(projectUrl);
    await page.locator("#confirmation").fill("DELETE");
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByText(/Project and its sessions were deleted|Project.*deleted/).waitFor();
  });

  await step("verify cleanup", async () => {
    const assets = await sql`select id from media_assets where session_id = ${sessionId}`;
    const pending = await sql`select id from multipart_uploads where session_id = ${sessionId}`;
    if (assets.length > 0 || pending.length > 0) {
      throw new Error("Project deletion left assets or pending uploads behind.");
    }
  });

  console.log("MULTIPART SMOKE PASSED");
} catch (error) {
  await page.screenshot({ path: ".smoke-multipart-failure.png", fullPage: true }).catch(() => undefined);
  console.log("MULTIPART SMOKE FAILED:", currentStep, "-", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
  rmSync(fixture, { force: true });
}
