import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const spoolPath = join(root, ".worker-error-spool.ndjson");
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX_RE = /\b[0-9a-f]{16,}\b/gi;
const DATE_RE = /\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?\b/g;
const NUM_RE = /\b\d{4,}\b/g;
const ANSI_RE = /\u001b\[[0-9;]*m/g;

function redact(value, max = 6000) {
  return String(value ?? "")
    .replace(ANSI_RE, "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(postgres(?:ql)?|mysql|redis):\/\/[^\s"'<>]+/gi, "$1://[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "sk-[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .slice(0, max);
}

function normalize(value, max = 500) {
  return redact(value, max)
    .replace(DATE_RE, "<date>")
    .replace(UUID_RE, "<uuid>")
    .replace(HEX_RE, "<hash>")
    .replace(NUM_RE, "<number>")
    .replace(/https?:\/\/[^\s)]+/gi, "<url>")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(input) {
  const frames = (input.stack ?? "")
    .split(/\r?\n/)
    .filter((line) => /^\s*at\s+/.test(line))
    .slice(0, 4)
    .map((line) => normalize(line.replace(/:\d+:\d+\b/g, ""), 300));
  return createHash("sha256")
    .update([input.source, input.name ?? "Error", normalize(input.message), normalize(input.route ?? "", 200), ...frames].join("|"))
    .digest("hex")
    .slice(0, 32);
}

function details(error) {
  if (error instanceof Error) {
    return { name: error.name || "Error", message: error.message || "Unknown error", stack: error.stack ?? null, cause: error.cause instanceof Error ? error.cause.message : typeof error.cause === "string" ? error.cause : null };
  }
  if (typeof error === "string") return { name: "Error", message: error, stack: null, cause: null };
  if (error && typeof error === "object") {
    const record = error;
    return { name: typeof record.name === "string" ? record.name : "Error", message: typeof record.message === "string" ? record.message : JSON.stringify(error).slice(0, 2000), stack: typeof record.stack === "string" ? record.stack : null, cause: typeof record.cause === "string" ? record.cause : null };
  }
  return { name: "Error", message: "Unknown error", stack: null, cause: null };
}

function spool(input) {
  try {
    appendFileSync(spoolPath, `${JSON.stringify(input)}\n`, "utf8");
  } catch {
    // Nothing else we can do without a filesystem.
  }
}

export async function captureError(sql, input, options = {}) {
  const info = details(input.error);
  const message = redact(input.message ?? info.message, 4000);
  const name = redact(input.name ?? info.name, 160);
  const stack = input.stack ?? info.stack;
  const cause = redact(input.cause ?? info.cause ?? "", 2000) || null;
  const route = input.route ? redact(input.route, 600) : null;
  const action = input.action ? redact(input.action, 300) : null;
  const context = input.context && typeof input.context === "object" ? input.context : {};
  const fp = input.fingerprint ?? fingerprint({ source: input.source, name, message, stack, route });
  const release = process.env.APP_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || null;
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "production";

  try {
    const existing = await sql`select id, status from error_incidents where fingerprint = ${fp} limit 1`;
    let incidentId = existing[0]?.id;
    if (!incidentId) {
      const inserted = await sql`
        insert into error_incidents
          (fingerprint, title, severity, status, source, environment, release, route, action, error_name, error_message, top_frame, cause, context, first_seen_at, last_seen_at, updated_at)
        values
          (${fp}, ${redact(`${name}: ${message}`, 240)}, ${input.severity ?? "error"}, 'new', ${input.source},
           ${environment}, ${release}, ${route}, ${action}, ${name}, ${message}, ${stack ? redact(stack.split(/\r?\n/).find((line) => /^\s*at\s+/.test(line)) ?? "", 500) : null},
           ${cause}, ${JSON.stringify(context)}::jsonb, now(), now(), now())
        returning id
      `;
      incidentId = inserted[0]?.id;
    } else {
      await sql`
        update error_incidents set
          occurrence_count = occurrence_count + 1,
          regression_count = regression_count + case when status in ('fixed','verified','archived','wont_fix') then 1 else 0 end,
          status = case when status in ('fixed','verified','archived','wont_fix') then 'new' else status end,
          last_seen_at = now(), updated_at = now()
        where id = ${incidentId}
      `;
    }
    if (!incidentId) return null;
    await sql`
      insert into error_events
        (incident_id, source, severity, environment, release, route, action, job_type, job_id, project_id, session_id, timeline_id, media_id, error_name, message, stack, cause, context, breadcrumbs, user_agent, redacted)
      values
        (${incidentId}, ${input.source}, ${input.severity ?? "error"}, ${environment}, ${release}, ${route}, ${action},
         ${input.jobType ?? null}, ${input.jobId ?? null}, ${input.projectId ?? null}, ${input.sessionId ?? null},
         ${input.timelineId ?? null}, ${input.mediaId ?? null}, ${name}, ${message}, ${stack ? redact(stack, 12000) : null}, ${cause},
         ${JSON.stringify(context)}::jsonb, ${JSON.stringify(input.breadcrumbs ?? [])}::jsonb, ${input.userAgent ?? null}, true)
    `;
    return incidentId;
  } catch (error) {
    if (options.spoolOnFailure !== false) spool({ ...input, error: { name: info.name, message: info.message, stack: info.stack } });
    console.error(`error-ledger: could not record ${name}: ${error && error.message ? error.message : String(error)}`);
    return null;
  }
}

export async function flushErrorSpool(sql) {
  if (!existsSync(spoolPath)) return 0;
  const lines = readFileSync(spoolPath, "utf8").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return 0;
  const remaining = [];
  let flushed = 0;
  for (const line of lines) {
    try {
      const input = JSON.parse(line);
      const id = await captureError(sql, input, { spoolOnFailure: false });
      if (id) flushed += 1;
      else remaining.push(line);
    } catch {
      remaining.push(line);
    }
  }
  writeFileSync(spoolPath, remaining.length ? `${remaining.join("\n")}\n` : "", "utf8");
  return flushed;
}
