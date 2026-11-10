import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTBOX = join(process.cwd(), ".otp-outbox.jsonl");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function readEnvLocal() {
  const map = new Map();
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      map.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
    }
  } catch {
    // no local env file
  }
  return map;
}

export function sessionToken(secret, userId, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      v: 2,
      sub: userId,
      exp: now + SESSION_TTL_MS,
      n: randomBytes(12).toString("base64url"),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function addSessionCookie(context, base, secret, userId) {
  await context.addCookies([
    {
      name: "devlogue_session",
      value: sessionToken(secret, userId),
      url: base,
      httpOnly: true,
      secure: base.startsWith("https"),
      sameSite: "Lax",
    },
  ]);
}

async function waitForCode(email, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const lines = readFileSync(OUTBOX, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines.reverse()) {
        const entry = JSON.parse(line);
        if (entry.email === email && /^\d{6}$/.test(entry.code)) return entry.code;
      }
    } catch {
      // outbox not written yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in code was written for ${email}. Is the app running in development with the dev outbox enabled?`);
}

export async function loginWithCode(page, base, email) {
  writeFileSync(OUTBOX, "");
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByText(/Code sent to/).waitFor({ timeout: 60_000 });
  const code = await waitForCode(email);
  await page.getByLabel("Six-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}
