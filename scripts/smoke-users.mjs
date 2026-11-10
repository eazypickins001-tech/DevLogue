import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";
import { loginWithCode } from "./auth-helper.mjs";

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
const adminEmail = env.get("OWNER_EMAIL");
if (!adminEmail) throw new Error("OWNER_EMAIL is missing from .env.local");
const databaseUrl = env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is missing from .env.local");
const sql = neon(databaseUrl);

const memberEmail = `smoke-${Date.now().toString().slice(-8)}@example.com`;
const memberName = "Smoke Member";

const browser = await chromium.launch();
const adminContext = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const admin = await adminContext.newPage();
const memberContext = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const member = await memberContext.newPage();
admin.setDefaultTimeout(60_000);
member.setDefaultTimeout(60_000);

let currentStep = "startup";

async function step(label, fn) {
  currentStep = label;
  process.stdout.write(`- ${label}… `);
  await fn();
  console.log("ok");
}

async function rowFor(email) {
  const row = admin.locator("tr").filter({ hasText: email }).first();
  await row.waitFor();
  return row;
}

try {
  await step("admin signs in", async () => {
    await loginWithCode(admin, BASE, adminEmail);
    await admin.goto(`${BASE}/operations/users`);
    await admin.getByRole("heading", { name: "Users" }).waitFor();
  });

  await step("new user signs up", async () => {
    await loginWithCode(member, BASE, memberEmail);
    await member.getByRole("heading", { name: "Dashboard" }).waitFor();
  });

  await step("member cannot open user management", async () => {
    await member.goto(`${BASE}/operations/users`);
    await member.waitForURL("**/dashboard");
  });

  await step("member edits their profile", async () => {
    await member.goto(`${BASE}/settings`);
    await member.getByLabel("Display name").fill(memberName);
    await member.getByRole("button", { name: "Save profile" }).click();
    await member.getByText("Profile updated.").waitFor();
    await member.reload();
    await member.getByLabel("Display name").waitFor();
    const value = await member.getByLabel("Display name").inputValue();
    if (value !== memberName) throw new Error(`Profile name is ${value}.`);
  });

  await step("admin sees the account", async () => {
    await admin.goto(`${BASE}/operations/users`);
    const row = await rowFor(memberEmail);
    await row.getByText(memberName).waitFor();
    const role = await row.getByLabel(`Role for ${memberEmail}`).inputValue();
    if (role !== "member") throw new Error(`New account role is ${role}.`);
  });

  await step("admin promotes the member", async () => {
    const row = await rowFor(memberEmail);
    await row.getByLabel(`Role for ${memberEmail}`).selectOption("admin");
    await row.getByRole("button", { name: "Save" }).click();
    await admin.getByText(`${memberEmail} is now admin.`).waitFor();
    const value = await row.getByLabel(`Role for ${memberEmail}`).inputValue();
    if (value !== "admin") throw new Error(`Role is ${value}.`);
  });

  await step("promoted member can open user management", async () => {
    await member.goto(`${BASE}/operations/users`);
    await member.getByRole("heading", { name: "Users" }).waitFor();
  });

  await step("admin demotes the member", async () => {
    await admin.goto(`${BASE}/operations/users`);
    const row = await rowFor(memberEmail);
    await row.getByLabel(`Role for ${memberEmail}`).selectOption("member");
    await row.getByRole("button", { name: "Save" }).click();
    await admin.getByText(`${memberEmail} is now member.`).waitFor();
    const value = await row.getByLabel(`Role for ${memberEmail}`).inputValue();
    if (value !== "member") throw new Error(`Role is ${value}.`);
  });

  await step("admin suspends the member", async () => {
    await admin.goto(`${BASE}/operations/users`);
    const row = await rowFor(memberEmail);
    await row.getByRole("button", { name: "Suspend" }).click();
    await admin.getByText(`${memberEmail} was suspended.`).waitFor();
    await row.getByText("suspended").waitFor();
  });

  await step("suspended member loses access", async () => {
    await member.goto(`${BASE}/dashboard`);
    await member.waitForURL("**/login");
  });

  await step("admin reactivates the member", async () => {
    await admin.goto(`${BASE}/operations/users`);
    const row = await rowFor(memberEmail);
    await row.getByRole("button", { name: "Reactivate" }).click();
    await admin.getByText(`${memberEmail} was reactivated.`).waitFor();
  });

  console.log("USERS SMOKE PASSED");
} catch (error) {
  await admin.screenshot({ path: ".smoke-users-failure.png", fullPage: true }).catch(() => undefined);
  console.log("USERS SMOKE FAILED:", currentStep, "-", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql`delete from users where email = ${memberEmail}`.catch(() => undefined);
  await browser.close();
}
