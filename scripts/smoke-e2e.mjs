import { readFileSync } from "node:fs";
import { chromium } from "playwright";

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

const name = `DevLogue Smoke ${Date.now().toString().slice(-6)}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.setDefaultTimeout(45_000);
page.on("dialog", (dialog) => void dialog.accept());

let projectUrl = "";

async function step(label, fn) {
  process.stdout.write(`- ${label}… `);
  await fn();
  console.log("ok");
}

try {
  await step("login", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Enter DevLogue" }).click();
    await page.waitForURL("**/dashboard");
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  });

  await step("create project", async () => {
    await page.goto(`${BASE}/projects/new`);
    await page.getByLabel("Project name").fill(name);
    await page.getByLabel("Short description").fill("Automated smoke project for DevLogue.");
    await page.getByLabel("Problem being solved").fill("Content work is disconnected from real building.");
    await page.getByLabel("Target users").fill("Solo software builders.");
    await page.getByLabel("LinkedIn").check();
    await page.getByLabel("Instagram").check();
    await page.getByLabel("Preferred tone").fill("Dry, specific, first person, no hype.");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/);
    projectUrl = page.url();
    await page.getByText("Project created.").waitFor();
  });

  await step("save GHL accounts", async () => {
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

  await step("capture session", async () => {
    const projectId = projectUrl.split("/").pop();
    await page.goto(`${BASE}/sessions/new?projectId=${projectId}`);
    await page.getByLabel("Session title").fill("Built the HighLevel publishing handoff");
    await page
      .getByLabel("What did you work on?")
      .fill("Added a HighLevel draft publishing path with a signed media handoff.");
    await page
      .getByLabel("Problem encountered")
      .fill("HighLevel could not read private R2 presigned media URLs.");
    await page
      .getByLabel("What changed?")
      .fill("Added handoff route, direct multipart fallback, fixed post id extraction, added test mode.");
    await page.getByLabel("What worked").fill("Draft creation and deletion through the API.");
    await page.getByLabel("What failed").fill("Hosted media fetch from R2 returned 400.");
    await page
      .getByLabel("What did you learn?")
      .fill("Provider fetchers may strip presigned query strings; own the handoff URL.");
    await page.getByLabel("What remains unfinished?").fill("Reel draft with video on production.");
    await page.getByLabel("Next task").fill("Deploy and test the handoff route on Vercel.");
    await page
      .getByLabel(/safe to publish/)
      .check();
    await page.getByRole("button", { name: "Save session" }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
    await page.getByText(/Session captured/).waitFor();
  });

  await step("add evidence", async () => {
    const details = page.locator("details").filter({ hasText: "Add evidence" });
    if (!(await details.evaluate((element) => element.open))) {
      await details.locator("summary").click();
    }
    await page.getByLabel("Title", { exact: true }).fill("commit: add HighLevel draft adapter");
    await page.getByLabel("URL").fill("https://github.com/eazypickins001-tech/DevLogue/commit/smoke");
    await page.getByLabel(/I verified this evidence/).check();
    await page.getByRole("button", { name: "Add evidence" }).click();
    await page.getByText("Evidence added.").waitFor();
  });

  await step("analyze session", async () => {
    await page.getByRole("button", { name: "Analyze session" }).click();
    await page.getByRole("heading", { name: "Session analysis" }).waitFor({ timeout: 180_000 });
  });

  await step("generate content", async () => {
    await page.getByLabel("X post").uncheck();
    await page.getByRole("button", { name: "Generate content" }).click();
    await page.getByText(/Generated /).waitFor({ timeout: 240_000 });
  });

  await step("approve a draft", async () => {
    await page.goto(`${BASE}/studio`);
    const row = page.locator("li").filter({ hasText: "LinkedIn post" }).first();
    await row.locator("a").first().click();
    await page.getByRole("button", { name: /Approve version/ }).click();
    await page.locator('[role="status"]').filter({ hasText: "Approved version" }).waitFor();
  });

  await step("create HighLevel draft", async () => {
    const panel = page.locator("#publishing");
    await panel.getByRole("checkbox").first().check();
    await panel.getByRole("button", { name: "Create HighLevel draft" }).click();
    await page.getByText(/Test mode: nothing was published/).waitFor({ timeout: 120_000 });
    await page.getByText(/Created:/).waitFor();
  });

  await step("remove HighLevel draft", async () => {
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
    await page.getByText(/Publishing record removed/).waitFor({ timeout: 60_000 });
  });

  await step("cleanup project", async () => {
    await page.goto(projectUrl);
    await page.locator("#confirmation").fill("DELETE");
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByText(/Project and its sessions were deleted|Project.*deleted/).waitFor();
  });

  console.log("SMOKE PASSED");
} catch (error) {
  await page.screenshot({ path: ".smoke-failure.png", fullPage: true }).catch(() => {});
  console.log("SMOKE FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
  process.exit(process.exitCode ?? 0);
}
