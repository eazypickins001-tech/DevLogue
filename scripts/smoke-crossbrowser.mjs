import { spawnSync } from "node:child_process";

const browsers = ["chromium", "firefox", "webkit"];
const results = [];

for (const browser of browsers) {
  console.log(`\n=== ${browser} ===`);
  const result = spawnSync(process.execPath, ["scripts/smoke-readonly.mjs"], {
    env: { ...process.env, SMOKE_BROWSER: browser },
    stdio: "inherit",
  });
  results.push({ browser, ok: result.status === 0 });
}

console.log("\nCross-browser summary:");
for (const result of results) {
  console.log(`${result.browser}: ${result.ok ? "passed" : "failed"}`);
}
if (results.some((result) => !result.ok)) process.exitCode = 1;
