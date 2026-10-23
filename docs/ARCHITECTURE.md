# Architecture

## Runtime boundaries

- **Next.js App Router on Vercel.** Every workspace route is `force-dynamic`; no database access happens at build time.
- **Server-only modules** (`src/lib/auth.ts`, `src/lib/queries.ts`, `src/lib/storage.ts`, `src/lib/ai/provider.ts`) import `server-only`. Secrets never enter the client bundle.
- **Server actions** perform every mutation. Each action re-checks the session cookie and scopes queries by the owner's `userId`; UI hiding is not treated as authorization.
- **No middleware.** The `(app)` route group layout gates rendering, and each action independently guards. This avoids Next 16 middleware/proxy churn and prevents a bypass if a route is moved.

## Data model

Declared in `src/db/schema.ts`, generated SQL in `drizzle/0000_*.sql`.

```
users
  └── projects (slug unique per user, archive flag, platforms enum[])
        ├── build_sessions (status: captured|analyzed|drafted|archived)
        │     ├── session_evidence (commit, pull_request, release, issue, screenshot, recording, note, transcript, link)
        │     ├── media_assets (private R2 key, size, type, duration/dimensions)
        │     │     └── transcripts (segments jsonb, manual or future ASR)
        │     └── ai_analyses (provider, model, promptVersion, summary jsonb, gaps, tokens, reported cost, status)
        ├── content_drafts (format, target platform, payload jsonb, currentVersion, approvedVersion)
        │     ├── draft_versions (unique per draft+version, source: ai|user)
        │     ├── storyboards → storyboard_scenes (ordered, durations, source asset)
        │     ├── approvals (version, approver, timestamp)
        │     └── scheduled_posts → publishing_jobs
        ├── publishing_accounts
        ├── feedback
        ├── waiting_list_refs
        └── render_jobs
usage_records (per user, provider, task, model, tokens, reported cost)
integrations (non-secret config only; secrets stay in env)
```

Design choices:

- **Versioning instead of mutation.** Editing creates `draft_versions`; `content_drafts.currentVersion` points at the latest. `approvedVersion` remains even when a newer edit resets status to `needs_review`.
- **Approval is separate from publication.** `approvals` records who approved which version. `scheduled_posts.status` is driven by the provider, never inferred.
- **Evidence ids are first-class.** Analyses reference evidence ids; the deterministic lint checks numbers against the evidence corpus.
- **Structured payload plus rendered body.** `payload jsonb` keeps machine-readable output (thread posts, scenes); `body` is what the user edits and publishes.
- **Nullable user scope everywhere.** A single user today, multi-tenant later without a migration rewrite.

## AI layer

`src/lib/ai/provider.ts`

- `generateStructured()` selects a provider from `AI_PROVIDER`, resolves a per-task model from env, calls an OpenAI-compatible chat endpoint, parses JSON defensively, validates with Zod, and retries once with the validation error for repair.
- Transient 429/5xx responses retry with backoff; each attempt has a 90s abort timeout.
- Provider responses are redacted with `redactSecrets()` before surfacing.
- Usage is recorded in `usage_records`. `costUsd` stays `null` unless the provider reports `usage.cost`.

Prompts (`src/lib/ai/prompts.ts`) state the anti-fabrication rules, include the JSON schema derived from Zod, and pass only selected session/evidence text.

Format schemas (`src/lib/ai/schemas.ts`) cover text, threads, outlines, changelog and storyboards. `payloadToBody()` renders a deterministic editable body.

## Video path

- Generation produces a storyboard with 2-12 scenes. `normalizeStoryboard()` allocates the target duration across scenes within 2-15s limits, so durations always sum to the achievable target.
- Scenes store `sourceAssetId` only when the id belongs to a media asset in the same session.
- Render jobs are modelled but not executed. The intended worker is a local Node process using FFmpeg (and optional Whisper) reading `render_jobs`, writing to R2, and updating status. This keeps heavy work off Vercel functions.

## Publishing path

- `publishing_accounts` maps project → provider → external account id.
- The verified HighLevel Social Planner API accepts draft/scheduled posts with `accountIds`, `type`, `userId`, optional `summary`/`media`/`scheduleDate`, and requires `Version: 2021-07-28`.
- Scheduling is deliberately not enabled without credentials. The calendar presents approved drafts for manual handoff. A provider adapter would sit behind an interface so HighLevel can be replaced by direct platform APIs later.
- Duplicate scheduling prevention is implemented as a pure function (`findScheduleConflicts`) with tests, ready for the scheduling action.

## Upload security

- Client requests a presigned PUT for a key under `media/<ownerId>/<uuid>/<safeFilename>`.
- Upload goes directly to R2; the server never proxies large bodies.
- On completion the server re-validates filename/type/size, performs a `HEAD` for the real byte size, and reads the first 32 bytes to verify magic numbers against the declared kind.
- Reads go through `/api/media/[id]`, which requires a valid session and issues a 5-minute signed URL. Documents download as attachments; images/video/audio render inline.

## Deterministic quality checks

`src/lib/domain/content.ts` and `src/lib/domain/storyboard.ts` implement checks without an LLM:

- Platform character limits (Instagram 2200, LinkedIn 3000, X 280).
- Generic marketing phrase list.
- Exclamation and emoji overload.
- Numbers present in a draft that do not appear anywhere in the evidence corpus.
- Storyboard duration sum, scene count and missing narration/text.

Errors block approval morally rather than technically; the UI surfaces them and approval requires the user to act.

## Testing strategy

77 Vitest unit tests cover: session signing/expiry/tampering, storyboard normalization and validation, content lint rules, duplicate scheduling, timezone fallback, MIME classification, filename safety, upload limits, magic bytes, secret redaction, Zod validation schemas, AI schema mapping and body rendering.

External services are never called in tests. Live integration verification uses the read-only checks on `/integrations`.
