# DevLogue Build Plan

Last updated: 2026-10-26
Baseline commit: `19c84df` (landing page, PWA, help, worker controls)
Baseline production: `https://devlogue-prod.vercel.app`

This document is the working reference for the next build phases. It records the known risks and the agreed order of work.

## Current baseline

Implemented:

- Project/session/evidence workflow.
- Screen/camera/microphone/system-audio recording.
- 16:9 and 9:16 recording with camera PiP and camera-hidden modes.
- Multi-track timeline editor with trim, captions, sync offsets and versioned saves.
- Final MP4 rendering through the local/Contabo worker.
- Whisper transcription and timed captions.
- Video thumbnails and audio waveforms.
- Timeline -> rendered MP4 -> short-video content draft -> HighLevel handoff.
- Multipart uploads with retry, progress and resume-after-reload.
- Project/timeline/media deletion with R2 cleanup.
- Public landing page, light/dark/system themes, help guide and PWA installability.
- Worker control service/UI (requires separate control service configuration).

Quality baseline:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (145 tests)
- `pnpm build`

## Risk register

| # | Risk | Severity | Why it matters | Mitigation |
|---|------|----------|----------------|------------|
| 1 | Worker is not hosted/always-on | Critical | Transcription, previews and renders cannot run on Vercel | Deploy worker + control service to Contabo or an always-on machine; real status in UI; clear "local worker required" states |
| 2 | Content Studio vs Video Editor vs Video Production overlap | High | Users cannot find where recordings become content | Unify workflow: Studio lists drafts and timelines; reduce top-level destinations |
| 3 | Preview is custom and not obviously playable | High | Users think the video is blank | Play overlay, source preview, loading/error states, poster fallbacks, clear playhead behavior |
| 4 | Content Studio only shows drafts | High | An edited recording appears to "disappear" | Show timelines in Studio; explicit render -> create-draft path |
| 5 | Landing page says "Worker ready" statically | Medium | Misleading operational status | Replace with "Worker on demand" or live status |
| 6 | PWA service worker cache is manually versioned | Medium | Deployments can serve stale JS | Build-versioned cache or network-first for app chunks; add update flow |
| 7 | Dark mode is CSS overrides | Medium | Maintenance burden and inconsistent components | Introduce design tokens and refactor shared components |
| 8 | Navigation does not scale | Medium | Too many top-level links; mobile is crowded | Group navigation; desktop sidebar + mobile bottom nav |
| 9 | Tests are mostly unit-level | High | Critical workflows break silently | E2E coverage for record -> upload -> render -> draft -> publish; CI |
| 10 | Single-user auth | Medium | "Projects" imply multi-user but there is no tenancy | Decide whether this remains a single-user tool or add workspaces/roles |
| 11 | Storage policy is incomplete | Medium | R2 can grow without visibility | Usage dashboard, retention rules, orphan sweep, lifecycle policy |
| 12 | Process: long work without updates | High | User cannot steer or catch confusion | Short milestones; progress updates; 90% context warning and handover note |

## Build order

### Phase 1 - Unify the studio workflow

Goal: a user can always see both drafts and timelines in one place.

- [x] Add video timelines to `/studio` alongside text drafts.
- [x] Rename the destination to "Studio" in navigation and page copy.
- [x] Add status badges for timeline draft/rendered/failed and draft approval state.
- [ ] Add a single primary action: Record or Open Video Editor.
- [x] Make "Create content draft" discoverable only after a successful render.
- [x] Add empty states that explain text drafts vs video drafts.
- [x] Reduce overlapping navigation labels: Build Sessions, Record, Video Editor, Content Studio, Video Production.
- [ ] Add links between session, timeline, draft and publishing calendar.

Acceptance:

- A project with only timelines shows those timelines in Studio.
- A rendered timeline can create a draft without visiting another hidden screen.
- A user can answer "where did my recording go?" from the Studio page alone.

### Phase 2 - Make the worker operational

Goal: production is not dependent on the user manually opening a terminal.

- [x] Choose worker host: Contabo VPS or always-on PC.
- [x] Run `render-worker.mjs` and `worker-control.mjs` as services (PM2/systemd/Windows service).
- [x] Expose the control service through an authenticated HTTPS endpoint.
- [x] Set `WORKER_CONTROL_URL` and `WORKER_CONTROL_TOKEN` in Vercel and local env.
- [x] Add real worker status to Dashboard, Video Editor and Studio.
- [ ] Add start/stop/restart controls with confirmation and audit text.
- [x] Add worker log tail or last-error summary.
- [x] Add queue counts by job type.
- [ ] Add retry/cancel for failed jobs.
- [ ] Add stale-job recovery and concurrency limits.
- [ ] Verify a 10-15 minute recording end-to-end in production.

Acceptance:

- Starting/stopping the worker works from the UI.
- Rendering, transcription and previews run without a local terminal open.
- Failure states are visible and retryable.

### Phase 3 - Editor preview and confidence

Goal: editing a video never looks like a blank screen.

- [x] Add a clear Play overlay and loading state.
- [ ] Add native source playback or a source preview panel.
- [x] Show current clip, selected track and playhead time.
- [x] Add poster fallback while thumbnails are missing.
- [ ] Show a clear message when media is still processing.
- [x] Add preview error states with links to repair media.
- [x] Add autosave or a clear unsaved-changes warning.
- [ ] Add optimistic concurrency/version conflict handling.
- [ ] Add undo/redo persistence across refreshes.
- [ ] Test Chrome/Edge/Firefox/Safari where feasible.

Acceptance:

- Paused preview always shows a frame or an explicit processing/error state.
- Saving and refreshing never loses edits silently.
- Users can watch the composed timeline before rendering.

### Phase 4 - Storage visibility and retention

Goal: users can understand and control R2 usage.

- [ ] Add storage usage by project, session, raw media, renders, thumbnails and waveforms.
- [x] Add orphan R2 sweep for deleted rows.
- [ ] Add retention policy for raw tracks and renders.
- [ ] Add bulk cleanup for completed projects.
- [x] Add confirmation details for orphan deletion.
- [x] Add R2 lifecycle recommendation/documentation.
- [ ] Show storage warnings before large recordings/uploads.

Acceptance:

- Deleted media leaves no hidden R2 cost.
- Users can see what is using storage before deleting.

### Phase 5 - Design system, navigation, mobile and PWA

Goal: consistent UI that works on desktop and mobile.

- [ ] Introduce design tokens: color, spacing, typography, radius, shadows.
- [ ] Replace CSS override dark mode with token-based themes.
- [ ] Build desktop sidebar and mobile bottom navigation.
- [x] Group tools: Create, Studio, Publish, Insights, Settings.
- [ ] Improve forms, tables and timeline touch targets.
- [ ] Add safe-area handling and mobile record flow.
- [x] Build-version the service worker or switch app chunks to network-first.
- [ ] Add install prompt, offline page and update-available flow.
- [ ] Add PWA tests on Android/iOS/desktop.
- [ ] Add accessibility pass: focus, keyboard, contrast, reduced motion.

Acceptance:

- Light and dark themes are consistent across every page.
- Mobile capture works; mobile editing has a usable minimal path.
- PWA installs and updates without serving stale JS.

### Phase 6 - Verification and operations

Goal: catch regressions before users do.

- [x] Add CI for lint, typecheck, tests and build.
- [ ] Add Playwright E2E for record -> upload -> render -> draft -> publish.
- [x] Add CI-backed read-only Playwright smoke for auth, routes, preview, worker, PWA and mobile.
- [ ] Add multipart/resume E2E.
- [ ] Add project/timeline deletion E2E with R2 assertions.
- [ ] Add worker control E2E with a test control service.
- [ ] Add PWA/offline checks.
- [ ] Add backup/restore runbook.
- [ ] Add error monitoring and structured logs.
- [ ] Add rate limiting and auth hardening if multi-user is added.

Acceptance:

- A pull request cannot merge without green checks.
- The critical user journey is exercised automatically.

## Recommended next slice

Start with Phase 1 and the most visible part of Phase 3:

1. Add timelines to Studio.
2. Reduce navigation ambiguity.
3. Improve preview loading/play states.
4. Add real worker status messaging.

This gives immediate clarity without requiring the worker hosting decision first.

## Decisions needed

- Is DevLogue a single-user tool or a multi-user product?
- Should the worker run on Contabo permanently? If yes, who owns the control-service URL and token?
- Should "Studio" replace both Content Studio and Video Editor as top-level concepts?
- Should final renders auto-create drafts, or remain an explicit action?
- Should raw tracks be deleted automatically after a retention window?

## Context handover protocol

When the session approaches its practical context limit:

1. Stop starting new implementation work.
2. Record current commit and deployment IDs.
3. List modified files and routes.
4. Record test/build status.
5. List blockers and environment variables by name only.
6. Record the exact next command or code change.
7. Never include secrets, tokens or passwords in the handover.

### Phase 7 - Self-reporting incident ledger

Goal: every failure becomes a durable, searchable, redacted record with a fix and verification history.

- [x] Add grouped incidents and raw occurrence events in Postgres.
- [x] Add server, client, worker, smoke and manual capture paths.
- [x] Add fingerprinting, redaction and regression detection.
- [x] Add `/operations/errors` list/detail pages and manual report form.
- [x] Add Markdown and JSON AI debug briefs with copy action.
- [x] Add fixed/verified/archive lifecycle and audit notes.
- [x] Add worker DB-failure spool and transient-error grouping.
- [x] Add 90-day event-prune command.
- [x] Add automatic event-prune scheduling.
- [ ] Add optional email/Telegram incident digest.
- [ ] Add lifecycle/regression integration tests against a disposable database.