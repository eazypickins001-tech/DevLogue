import { chromium } from "playwright";
import { addSessionCookie, loginWithCode, readEnvLocal } from "./auth-helper.mjs";

const base = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const env = readEnvLocal();
const sessionSecret = process.env.AUTH_SECRET ?? env.get("AUTH_SECRET") ?? "";
const sessionUser = process.env.SMOKE_USER_ID ?? "";
const email = process.env.SMOKE_EMAIL ?? env.get("OWNER_EMAIL") ?? "";
if (!sessionUser && !email) {
  throw new Error("Set SMOKE_USER_ID and AUTH_SECRET, or SMOKE_EMAIL/OWNER_EMAIL for code login.");
}

const failures = [];
const consoleErrors = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(45_000);
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

async function step(label, fn) {
  process.stdout.write(`- ${label}... `);
  try {
    await fn();
    console.log("ok");
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : error}`);
    console.log("FAIL");
  }
}

try {
  await step("login", async () => {
    if (sessionSecret && sessionUser) {
      await addSessionCookie(context, base, sessionSecret, sessionUser);
      await page.goto(`${base}/dashboard`);
    } else {
      await loginWithCode(page, base, email);
    }
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  });

  const routes = [
    "/dashboard",
    "/projects",
    "/sessions",
    "/timelines",
    "/studio",
    "/video",
    "/calendar",
    "/analytics",
    "/integrations",
    "/feedback",
    "/settings",
    "/help",
    "/operations/errors",
    "/operations/storage",
    "/operations/users",
  ];

  for (const route of routes) {
    await step(`route ${route}`, async () => {
      const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? "unknown"}`);
      await page.getByRole("heading").first().waitFor();
    });
  }

  await step("studio primary action", async () => {
    await page.goto(`${base}/studio`);
    const editor = page.getByRole("link", { name: "Open video editor" });
    const record = page.getByRole("link", { name: "Record a session" });
    if ((await editor.count()) === 0 && (await record.count()) === 0) {
      throw new Error("No Studio primary action");
    }
  });

  await step("session cross-links", async () => {
    await page.goto(`${base}/sessions`);
    const link = page.locator('a[href^="/sessions/"]:not([href="/sessions/new"])').first();
    if ((await link.count()) === 0) {
      console.log("(no session; skipped) ");
      return;
    }
    await link.click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/);
    const main = page.locator("#main-content");
    await main.getByRole("link", { name: "Video editor" }).waitFor();
    await main.getByRole("link", { name: "Calendar" }).waitFor();
  });

  await step("accessibility", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/dashboard`);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    const skipState = await skip.evaluate((node) => ({
      focused: node === document.activeElement,
      position: getComputedStyle(node).position,
      outline: getComputedStyle(node).outlineStyle,
    }));
    if (!skipState.focused) throw new Error("Skip link is not the first tab stop");
    if (skipState.position !== "fixed") throw new Error("Skip link is not revealed on focus");
    if (skipState.outline === "none") throw new Error("Focused element has no visible outline");

    const menu = page.getByRole("button", { name: "Create", exact: true });
    await menu.focus();
    await page.keyboard.press("Enter");
    if ((await menu.getAttribute("aria-expanded")) !== "true") throw new Error("Menu did not open");
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Projects",
      undefined,
      { timeout: 5000 },
    );
    await page.keyboard.press("ArrowDown");
    const nextFocused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (nextFocused !== "Sessions") throw new Error(`ArrowDown focused ${nextFocused ?? "nothing"}`);
    await page.keyboard.press("Escape");
    if ((await menu.getAttribute("aria-expanded")) !== "false") throw new Error("Menu did not close on Escape");
    if (!(await menu.evaluate((node) => node === document.activeElement))) {
      throw new Error("Focus did not return to the menu trigger");
    }

    const current = page.locator('nav a[aria-current="page"]');
    if ((await current.count()) === 0) throw new Error("Active nav link is not marked aria-current");
  });

  await step("timeline preview", async () => {
    await page.goto(`${base}/timelines`);
    const timeline = page.locator('a[href^="/timelines/"]').first();
    if ((await timeline.count()) === 0) {
      console.log("(no timeline; skipped) ");
      return;
    }
    await timeline.click();
    await page.waitForURL(/\/timelines\/[0-9a-f-]{36}/);
    const play = page.getByRole("button", { name: "Play timeline preview" });
    if ((await play.count()) === 0) throw new Error("Play overlay missing");
    await play.click();
    let loaded = false;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const videos = await page.locator("video").evaluateAll((elements) =>
        elements.map((video) => ({
          readyState: video.readyState,
          time: video.currentTime,
          width: video.videoWidth,
        })),
      );
      if (videos.some((video) => video.readyState >= 2 && video.width > 0)) {
        loaded = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!loaded) throw new Error("Preview video did not load");
  });

  await step("worker panel", async () => {
    await page.goto(`${base}/video`);
    await page.getByText("Worker control", { exact: true }).waitFor();
    if (!/Worker (running|stopped|offline|not configured)|Checking worker/.test(await page.locator("body").innerText())) {
      throw new Error("Worker status text missing");
    }
  });

  await step("PWA", async () => {
    const manifest = await page.evaluate(async () => {
      const response = await fetch("/manifest.webmanifest");
      return { status: response.status, type: response.headers.get("content-type") };
    });
    if (manifest.status !== 200 || !manifest.type?.includes("manifest")) throw new Error("Manifest unavailable");
    if (!(await page.evaluate(() => "serviceWorker" in navigator))) throw new Error("Service worker unsupported");
  });

  await step("PWA offline", async () => {
    await page.goto(`${base}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    let ready = false;
    for (let attempt = 0; attempt < 5 && !ready; attempt += 1) {
      ready = await page.evaluate(async () =>
        Boolean(navigator.serviceWorker.controller) && Boolean(await caches.match("/offline.html")),
      );
      if (!ready) {
        await page.reload();
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
        });
      }
    }
    if (!ready) throw new Error("Service worker is not controlling the page or the offline page is not cached");
    await page.context().setOffline(true);
    try {
      const response = await page.goto(`${base}/offline-check-${Date.now()}`, { waitUntil: "domcontentloaded" });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? "unknown"}`);
      const text = await page.locator("body").innerText();
      if (!text.includes("You are offline")) throw new Error("Offline fallback page was not served");
    } finally {
      await page.context().setOffline(false);
    }
  });

  await step("mobile overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/dashboard", "/studio", "/timelines", "/operations/errors", "/operations/storage"]) {
      await page.goto(`${base}${route}`);
      const dimensions = await page.evaluate(() => ({
        inner: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      if (dimensions.scroll > dimensions.inner) throw new Error(`${route} overflows (${dimensions.scroll}px)`);
    }
  });
} finally {
  if (consoleErrors.length > 0) {
    failures.push(...consoleErrors.map((error) => `console: ${error}`));
  }
  if (failures.length > 0) {
    await page.screenshot({ path: ".smoke-failure.png", fullPage: true }).catch(() => undefined);
    console.error("\nREADONLY SMOKE FAILED");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("\nREADONLY SMOKE PASSED");
  }
  await browser.close();
}
