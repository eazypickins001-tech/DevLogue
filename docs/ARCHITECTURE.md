# Architecture

## Runtime boundaries

- **Next.js App Router on Vercel.** Every workspace route is `force-dynamic`; no database access happens at build time.
- **Server-only modules** (`src/lib/auth.ts`, `src/lib/queries.ts`, `src/lib/storage.ts`, `src/lib/ai/provider.ts`) import `server-only`. Secrets never enter the client bundle.
- **Server actions** perform every mutation. Each action re-checks the session cookie and scopes queries by the owner's `userId`; UI hiding is not treated as authorization.
- **Auth** supports email OTP and password. OTP codes are six digits, valid for 10 minutes, stored only as an HMAC-SHA256 hash keyed by `email + code + AUTH_SECRET`, single use, and capped at five attempts. Request and verify paths are rate-limited per IP and per email. The password remains a fallback so a mail outage does not lock the owner out.
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

Prompts (`src/lib/ai/prompts.ts`) state the anti-fabrication rules, include the JSON schema derived from Zod for both analysis and formats, and pass only selected session/evidence text. Requests use JSON mode, `max_tokens: 8000`, and (on OpenRouter) a 1024-token reasoning cap because free reasoning models otherwise consume the whole completion budget. A malformed response is repaired once with a stricter instruction; `parseModelJson()` tolerates fences, prose wrappers, raw newlines, and trailing commas.

Format schemas (`src/lib/ai/schemas.ts`) cover text, threads, outlines, changelog and storyboards. `payloadToBody()` renders a deterministic editable body.

## Video path

- Generation produces a storyboard with 2-12 scenes. `normalizeStoryboard()` allocates the target duration across scenes within 2-15s limits, so durations always sum to the achievable target.
- Scenes store `sourceAssetId` only when the id belongs to a media asset in the same session.
- Render jobs are queued from the UI and executed by a local Node worker (`scripts/render-worker.mjs`), keeping heavy work off Vercel. The worker claims jobs with `FOR UPDATE SKIP LOCKED`, renders each scene with FFmpeg (`scripts/render-plan.mjs` builds the arguments), concatenates, validates with `ffprobe`, uploads to R2 and records a `video` media asset. A Python helper (`scripts/transcribe.py`) runs faster-whisper on uploaded video/audio and stores timestamped segments; generated renders are excluded from transcription.

## Publishing path

- `publishing_accounts` maps project → provider → external account id. Accounts are discovered from HighLevel, not typed by hand.
- `src/lib/publishing/ghl.ts` wraps the verified Social Planner endpoints: account list, user discovery, media upload (multipart or hosted URL), post create, and delete. `Version: 2021-07-28` is sent on every call.
- Test mode (`GHL_TEST_MODE=true`, default) forces `status: draft` and ignores schedule fields. With test mode off, `scheduleDate` is converted from the chosen local time and IANA timezone to UTC and sent with `status: scheduled`.
- `src/lib/publishing/handoff.ts` issues short-lived HMAC tokens for `/api/publishing-media/[token]`. HighLevel fetches that public-but-unguessable URL as hosted media; this exists because HighLevel could not read private R2 presigned URLs (verified 400 `UNABLE_TO_DETERMINE_CONTENT_TYPE`).
- Local and small assets (≤25MB) fall back to direct multipart upload, so development does not need a public URL.
- Every attempt writes a `scheduled_posts` row and a `publishing_jobs` row. Existing draft/scheduled/publishing records block duplicates, and `findScheduleConflicts` prevents same-account posts within five minutes.
- The user must approve a specific version before the handoff form is available. Approving still does not publish anything.

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

Vitest unit tests cover session signing/expiry/tampering, storyboard normalization and validation, content lint rules, duplicate scheduling, timezone conversion, MIME classification, filename safety, upload limits, magic bytes, secret redaction, handoff tokens, JSON repair, publishing status/type mapping, Zod validation schemas, AI schema mapping, body rendering, and render-plan argument construction (scene timing, inputs, caption wrapping, Whisper JSON). A Playwright smoke script (`scripts/smoke-e2e.mjs`) exercises the full local flow, including a real HighLevel draft that it deletes afterwards. The render pipeline was verified end to end with a generated clip: queue from the studio, worker render (1080×1920, 15s, AAC), R2 upload, media row and job success.

External services are never called in tests. Live integration verification uses the read-only checks on `/integrations`.
