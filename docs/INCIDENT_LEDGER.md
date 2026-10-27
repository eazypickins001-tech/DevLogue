# Incident Ledger

DevLogue records failures as incidents, not as an unsearchable stream of console logs. The goal is a durable, redacted record that can be turned into a precise debugging brief for a human or AI agent, then fixed, verified, archived and watched for regressions.

## Routes

- `/operations/errors` — incident list, filters and status counts
- `/operations/errors/[id]` — detail, context, occurrences, audit trail, update and verification form
- `/operations/errors/[id]/brief` — Markdown debug brief
- `/operations/errors/[id]/brief?format=json` — machine-readable bundle
- `/operations/errors/report` — manual report form
- `POST /api/errors/client` — authenticated client error ingest

## Data model

`error_incidents` is the grouped record. `error_events` stores individual occurrences. `error_incident_notes` stores the audit trail.

Incidents are fingerprinted from source, error name, normalized message, route/action and the top stack frames. UUIDs, dates, long numbers and URLs are normalized before hashing. Repeated events increment `occurrence_count`; a recurrence after `fixed`, `verified`, `archived` or `wont_fix` reopens the incident and increments `regression_count`.

## Lifecycle

```text
new → acknowledged → investigating → fixed → verified → archived
                                      ↘ wont_fix
```

- `fixed` requires a fix commit.
- `verified` requires a verification method or verification notes.
- `archived` and `wont_fix` retain the full history.
- Recurrence after a closed state reopens the incident as a regression.
- Every update writes an entry to the audit trail.

## Capture points

| Source | Capture |
| --- | --- |
| Server render/action/route | `src/instrumentation.ts` via Next.js `onRequestError` |
| Client crash boundary | `src/app/error.tsx` and `src/app/global-error.tsx` |
| Browser runtime | `src/components/error-reporter.tsx` (`window.error`, `unhandledrejection`) |
| Client offline | local queue flushed on reconnect |
| Worker job failure | `scripts/error-ledger.mjs` from `scripts/render-worker.mjs` |
| Worker transient loop failure | grouped warning, at most once per five minutes |
| Worker DB outage | JSON spool in `.worker-error-spool.ndjson`, flushed on a later worker start |
| Smoke test failure | `scripts/smoke-e2e.mjs` files the failed step, URL and screenshot path |
| Manual report | `/operations/errors/report` |

The worker reports job type, job ID, media/session/timeline IDs and attempt count. Existing failed-job tables remain the operational queue; the ledger links to them rather than replacing them.

## AI debug brief

The detail page exposes **Copy AI brief**, Markdown and JSON. A brief includes:

- incident identity, severity, status, source, environment and release
- route/action and related job/media/timeline/session/project IDs
- redacted context and latest breadcrumbs
- stack and cause
- current fix, resolution and verification fields
- audit history
- a reproduction hint and a read-only AI task instruction

The brief is deliberately plain Markdown so it can be pasted into an AI coding session without parsing logs.

## Privacy rules

All captured values pass through `src/lib/errors/redact.ts`:

- authorization headers, cookies, passwords, tokens, API keys and database URLs are redacted
- emails become `[email]`
- long URL query secrets are redacted
- strings, arrays, object depth and breadcrumb counts are bounded
- request bodies and full headers are never stored

Client ingest is authenticated and capped at 30KB. Error recording never throws into the failing request or job.

## Retention

- Incidents, notes and resolution history: retained indefinitely.
- Raw error events: recommended 90-day retention.
- Manual prune:

```powershell
$env:DATABASE_URL="postgresql://..."; pnpm prune:errors
```

Set `ERROR_EVENT_RETENTION_DAYS` to override 90 days.

## Worker and smoke signals

Worker failures create `source = worker` incidents if the database is reachable. If Neon is unavailable, the report is spooled locally and retried on the next worker start. Transient worker loop failures are captured as one warning incident per five minutes, which prevents a crash-loop from creating thousands of rows.

Smoke failures create `source = smoke` incidents with the failing step, page URL and `.smoke-failure.png` path. The screenshot itself is local; add an R2 upload step if permanent evidence is needed.

## Operational checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

Unit coverage currently includes fingerprint stability, source separation, stack extraction, secret redaction and breadcrumb bounds. Add lifecycle/regression integration tests when the ledger gets its next maintenance pass.
