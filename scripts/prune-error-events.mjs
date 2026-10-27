import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function databaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((item) => item.startsWith("DATABASE_URL="));
    return line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "").trim() ?? "";
  } catch {
    return "";
  }
}

const url = databaseUrl();
if (!url) throw new Error("DATABASE_URL is required.");
const days = Math.max(1, Number(process.env.ERROR_EVENT_RETENTION_DAYS ?? 90));
const sql = neon(url);
const deleted = await sql`
  delete from error_events
  where occurred_at < now() - (${days} * interval '1 day')
  returning id
`;
console.log(`Pruned ${deleted.length} error event(s) older than ${days} days.`);
