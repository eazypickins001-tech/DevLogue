# DevLogue

Build in public from real work. DevLogue turns documented development sessions into evidence-based social content, storyboards and HighLevel draft posts — without inventing results.

The product brief lives in [`docs/PROJECT_PROMPT.md`](docs/PROJECT_PROMPT.md). Architecture decisions are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The risk register and ordered build plan are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md). Failure history is documented in [`docs/INCIDENT_LEDGER.md`](docs/INCIDENT_LEDGER.md). Storage cleanup rules are in [`docs/STORAGE_RETENTION.md`](docs/STORAGE_RETENTION.md).

## What works today

- Multi-project workspace with stage, audience, positioning, exclusions and platform preferences.
- Build-session capture: manual notes plus structured evidence (commits, PRs, releases, issues, notes).
- Private media uploads to Cloudflare R2 with presigned PUT, multipart uploads for files above 16MB, per-part retry/progress, resume-after-reload, size/type validation, magic-byte checks and signed reads.
- Screen/camera recording: raw screen, camera, microphone and system-audio tracks; camera PiP can be off, recorded-only or visible; 16:9/9:16; saves to a session and creates an editable timeline.
- Timeline v1: multi-track preview, video thumbnails, audio waveforms, trim/timing inspector, camera/audio sync-offset nudges, source trim, captions, camera overlay visibility, 16:9/9:16 switch, versioned saves, and a final-render queue processed by the local worker.
- Session-to-editor flow: choose the destination session before recording, save raw tracks, and open the generated timeline from the session page or the saved-recording prompt.
- Transcript-driven captions: saving a recording queues microphone and system-audio transcription, the worker stores timestamped Whisper segments, and the editor turns the preferred transcript into timed text clips.
- Timeline-to-publishing handoff: a rendered timeline can create a short-video content draft; publishing that draft uploads only the rendered MP4, not the raw screen/camera tracks.
- AI session analysis with Zod-validated structured output, evidence gaps and per-claim evidence references.
- On-demand content generation (max 3 formats per batch) across 14 formats, including captions, threads, outlines, changelogs and short-video storyboards.
- Storyboards with durations normalized to the target runtime and scenes mapped to uploaded media.
- Local render worker: claims queued jobs, trims/loops source clips, scales to 1080×1920, burns captions, validates with ffprobe, uploads to R2. Whisper transcribes uploaded video/audio once per asset.
- Versioned drafts: AI output, user edits and the approved version are separate records.
- Deterministic quality checks: platform limits, generic phrases, hype punctuation, unsupported numbers.
- GoHighLevel Social Planner handoff: discover accounts, select per project, upload media, create **drafts** or **scheduled** posts, log jobs, remove drafts.
- Test mode (`GHL_TEST_MODE=true`, the documented default): posts are created as HighLevel drafts and never published.
- Studio with drafts and video timelines, calendar, feedback inbox, analytics from your own data, integration status and read-only connection checks.
- In-app help and user guide (`/help`) covering recording, editing, captions, rendering, publishing, storage and troubleshooting.
- Light, dark and system theme modes with a persisted preference.
- Public landing page at `/`, responsive app shell and basic PWA installation with offline fallback.
- Worker control panel on Video Production: start/stop the worker through a token-protected control service, with status pills, log tail, retry and stale-job recovery.
- Self-reporting incident ledger at `/operations/errors`: fingerprinting, redacted context, audit trail, regression detection, manual reports, smoke/worker/server/client capture, and Markdown/JSON AI debug briefs.
- R2 storage audit at `/operations/storage`: dry-run orphan scan against database keys, explicit confirmed deletion, and storage-by-project/kind visibility.

Verified end-to-end with Playwright: login → project → GHL account selection → session → evidence → AI analysis → content generation → approval → HighLevel draft creation → removal → cleanup. A real scheduled post was also created against the Ai4Beginners Facebook page (10:00 Africa/Kigali → 08:00Z), confirmed as `scheduled` in HighLevel, then deleted before publication.

**Live app:** https://devlogue-prod.vercel.app

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript | Vercel-native, server actions for mutations |
| Styling | Tailwind CSS 4 | No component dependency, small surface |
| Database | Neon Postgres via `@neondatabase/serverless` + Drizzle ORM | Free tier, HTTP driver, no Prisma engine on serverless |
| Storage | Cloudflare R2 (S3 API) via `aws4fetch` | 10GB free, no egress fees, presigned URLs |
| AI | OpenRouter or any OpenAI-compatible endpoint | Provider-agnostic, per-task model selection |
| Publishing | GoHighLevel Social Planner v2 | Verified accounts, media upload, draft/scheduled posts |
| Auth | Email OTP (Resend) + password fallback, HMAC-signed cookie | Free, single-user, no password manager needed |
| Tests | Vitest + a Playwright smoke script | Fast unit tests plus a real integration flow |

## Requirements

- Node.js 22+ and pnpm 10+
- A free [Neon](https://neon.tech) Postgres project
- A Cloudflare account with an R2 bucket
- An OpenRouter API key (or another OpenAI-compatible endpoint)
- A HighLevel sub-account with connected social accounts and a Private Integration Token
- Optional for video rendering: FFmpeg 8+ and Python 3.11+ (faster-whisper)

## Local setup

```powershell
pnpm install
Copy-Item .env.example .env.local
```

Generate an auth secret:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Fill `.env.local`:

```dotenv
APP_PASSWORD=<a long password>
AUTH_SECRET=<generated value>
OWNER_EMAIL=you@example.com
APP_PUBLIC_URL=
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
```

Apply the schema and start the app:

```powershell
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`, sign in, create a project, then capture a session.

### Sign-in

Email codes are the primary path. Add:

```dotenv
RESEND_API_KEY=re_...
AUTH_EMAIL_FROM=DevLogue <onboarding@resend.dev>
OWNER_EMAIL=you@example.com
```

Sign in with the owner email, receive a six-digit code (valid 10 minutes, single use, five attempts), and continue. The password form stays available under "Use the password instead".

Resend's free tier allows 3,000 emails/month (100/day). Until a domain is verified in Resend, `onboarding@resend.dev` can only send to the Resend account owner's address, which is exactly the single-user case.

### Cloudflare R2 (current dashboard)

1. **R2 object storage → Create bucket** (e.g. `devlogue-media`). Keep public access off.
   Note the bucket jurisdiction. Default jurisdiction uses `<ACCOUNT_ID>.r2.cloudflarestorage.com`.
2. **R2 → Overview → Account Details → API Tokens → Manage**
   - Create an **Account API token** (server-side) or **User API token**
   - Permissions: **Object Read & Write**
   - Scope: only `devlogue-media`
   - Copy the **Access Key ID** and **Secret Access Key** immediately (secret shown once)
   - Cloudflare requires R2 to be activated (payment method on file) before tokens can be created; the free allowance still applies.
3. **Bucket → Settings → CORS Policy → Add CORS policy → JSON**, paste:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://devlogue-prod.vercel.app",
      "https://devlogue-prod-eazypickins.vercel.app",
      "https://devlogue-prod-git-main-eazypickins.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

R2 matches the browser's exact origin. If you open a deployment-specific `*.vercel.app` URL, add that origin too. The current bucket rules can be checked with `wrangler r2 bucket cors list devlogue-media`.

4. Add to `.env.local`:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=devlogue-media
```

If the bucket was created in a jurisdiction (EU/US/FedRAMP), set `R2_ENDPOINT` to the jurisdiction endpoint instead of the default. The current implementation uses the default endpoint; contact the maintainer before using a jurisdictional bucket.

Uploads are private. Files up to 16MB use a single presigned PUT; larger files use R2 multipart uploads with per-part retry and progress; interrupted uploads appear on the session page with Resume and Cancel. The server verifies size and magic bytes before registering the asset. Reads go through `/api/media/[id]`, which requires the session cookie and redirects to a five-minute signed URL.

### AI provider

Free OpenRouter model (current default):

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
AI_MODEL=recursive/flint-v1.0:free
AI_MODEL_ANALYSIS=recursive/flint-v1.0:free
AI_MODEL_CONTENT=recursive/flint-v1.0:free
```

Reasoning models spend completion tokens on hidden reasoning. DevLogue caps reasoning at 1024 tokens, requests JSON mode, validates with Zod, and repairs malformed JSON once. If output still fails, it reports the error instead of silently switching to a paid model.

Any OpenAI-compatible endpoint:

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-host/v1
AI_API_KEY=...
AI_MODEL=...
```

Models are never hardcoded. Token usage is recorded; cost appears only when the provider reports it.

### GoHighLevel

Create a Private Integration Token with:

- `socialplanner/account.readonly`
- `socialplanner/post.readonly`
- `socialplanner/post.write`
- `medias.readwrite` (or `medias.readonly` + `medias.write`)
- `users.readonly`

Then:

```dotenv
GHL_API_TOKEN=
GHL_LOCATION_ID=
GHL_TEST_MODE=true
```

`GHL_USER_ID` is optional; DevLogue discovers it with `GET /users/?locationId=`.

Flow:

1. Open a project → **Publishing accounts** → **Load accounts from HighLevel** → select accounts → save.
2. Approve a draft in the studio.
3. In **Publishing handoff**, choose accounts and submit. With test mode on, HighLevel receives `status: draft`; the schedule fields are ignored.
4. Set `GHL_TEST_MODE=false` to send `status: scheduled` with the chosen time. This path is implemented but has not been published to a live account yet.

Verified endpoints:

- `GET /social-media-posting/{locationId}/accounts`
- `GET /users/?locationId=`
- `POST /medias/upload-file` (direct multipart, or `hosted:true` with a public URL)
- `POST /social-media-posting/{locationId}/posts` (`Version: 2021-07-28`)
- `DELETE /social-media-posting/{locationId}/posts/{id}`

Media strategy:

- **Local / small files (≤25MB):** direct multipart upload to HighLevel.
- **Production:** DevLogue serves a signed, expiring handoff URL at `/api/publishing-media/[token]`; HighLevel fetches it as `hosted` media. Set `APP_PUBLIC_URL` to the public HTTPS origin.
- **Timeline drafts:** when a draft is linked to a timeline, only the latest successful timeline render is uploaded. Raw screen/camera/microphone tracks are not sent to HighLevel.
- HighLevel's fetcher does not reliably read private R2 presigned URLs; the handoff route exists because of that verified failure.

## Local video worker

Rendering deliberately runs on your machine, not on Vercel. The web app only queues jobs.

```powershell
winget install Gyan.FFmpeg
python -m venv .venv
.\.venv\Scripts\pip install -r scripts\requirements-worker.txt
pnpm worker        # continuous
pnpm worker:once   # process one queued job
```

How it works:

1. Open a draft with a storyboard and choose **Queue render**.
2. The worker claims the oldest `queued` job with `FOR UPDATE SKIP LOCKED`.
3. Each scene becomes a 1080×1920 clip: source video/image scaled and padded, or a dark colour card when unmapped. On-screen text and narration are burned with `drawtext`.
4. Clips are concatenated, validated with `ffprobe` (size, duration, audio stream), uploaded to R2 and recorded as a `video` media asset.
5. The draft page and Video page show job status, errors and the rendered file link.
6. Timeline jobs use the same worker: it downloads the recording tracks, composites the main video and camera overlay, burns captions, mixes microphone/system audio, validates with ffprobe, uploads the MP4 to R2 and stores it as a media asset. The timeline page shows the queue and rendered file.
7. Saving a recording queues transcription for its microphone and system-audio tracks. The worker transcribes both; the timeline prefers the microphone transcript and falls back to system audio. The editor then generates timed captions from the stored segments.
8. Media derivative jobs generate a JPEG thumbnail for video and a PNG waveform for audio/video. Timeline clips use them as preview backgrounds; existing recording assets are backfilled when a timeline is opened.

Whisper (`faster-whisper`, `base.en` by default) transcribes uploaded video/audio once per asset and stores timestamped segments. It skips worker-generated renders, and silence is not stored as a transcript. `av==18.1.0` is pinned in `scripts/requirements-worker.txt` because faster-whisper 1.2.1 is incompatible with PyAV 19.

Optional environment overrides:

```dotenv
WHISPER_MODEL=base.en
FFMPEG_PATH=
FFPROBE_PATH=
RENDER_FONT=
```

Storyboard renders currently use a silent AAC track and burn narration on screen. Timeline renders mix the recorded microphone and system-audio tracks. Voice-over/TTS generation is not implemented yet.

## Worker control

The web app cannot spawn a process on your PC or VPS directly. Run the small control service on the worker machine:

```powershell
$env:WORKER_CONTROL_TOKEN="a-long-random-token"
pnpm worker:control
```

Then configure the app:

```dotenv
WORKER_CONTROL_URL=http://127.0.0.1:4100
WORKER_CONTROL_TOKEN=a-long-random-token
```

On Vercel, `WORKER_CONTROL_URL` must be a public HTTPS endpoint (for example a Cloudflare Tunnel to the control service) and the token must be kept secret. The control service listens on port 4100 and exposes `/health`, `/status`, `/log`, `/diag`, `/start` and `/stop`. Set `WORKER_CONTROL_AUTOSTART=true` to start the worker with the service. Use the **Worker control** panel on the Video Production page.

## Quality gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Integration smoke (needs `.env.local`, a running server on port 3000, valid R2/AI/GHL credentials, and creates then deletes a real HighLevel draft):

```powershell
pnpm smoke
```

Read-only production smoke (login, route health, preview, worker panel, PWA and mobile overflow; no mutations):

```powershell
$env:SMOKE_BASE_URL="https://devlogue-prod.vercel.app"
pnpm smoke:readonly
```

The `Read-only smoke` GitHub workflow runs on a schedule when the repository variable `SMOKE_BASE_URL` and secret `SMOKE_PASSWORD` are configured.

## Deployment (Vercel)

1. Push the repository to GitHub.
2. Import it in Vercel (Next.js preset, team project `devlogue-prod`, production branch `main`).
3. Add every variable from `.env.local`, plus `APP_PUBLIC_URL=https://<production-url>`.
4. Run migrations against production once:
   ```powershell
   $env:DATABASE_URL="postgresql://..."; pnpm db:migrate
   ```
5. Deploy, then add the production origin to the R2 CORS policy.
6. Keep `GHL_TEST_MODE=true` until you have verified drafts with your real accounts.

Server actions that call AI are capped at 60 seconds (`maxDuration`) because of Vercel Hobby limits. Generate at most three formats per batch.

## Data, privacy and retention

- AI prompts contain session and evidence text only. Media files are never sent to the model provider.
- Uploads are private; reads require an authenticated session and return a short-lived signed URL.
- Publishing media is exposed only through a short-lived, HMAC-signed handoff URL for HighLevel.
- Deleting a project cascades sessions, evidence, drafts, timelines and render jobs in Postgres, and removes its media, renders, thumbnails, waveforms and pending multipart uploads from R2. Deleting a timeline removes its rendered video but keeps raw recording tracks.
- No automatic purge job for application media. `/operations/storage` can preview and remove raw recording tracks older than `MEDIA_RETENTION_DAYS` (default 90) when no timeline or storyboard references them; renders and evidence media are kept. Error events use a 90-day Vercel Cron prune (`CRON_SECRET`) with `pnpm prune:errors` as the manual fallback; incidents and audit history are kept.
- Incident capture is local and private; no external error monitoring SaaS is required.

## Known limitations

- **Video rendering is local-only.** The worker needs FFmpeg and faster-whisper installed on the machine running it. Production can queue jobs but cannot render them. Storyboard renders use silent audio with on-screen narration; timeline renders mix the recorded microphone/system tracks. There is no TTS or voice-over generation yet.
- **PWA is installable but not a full offline app.** The landing/app shell and offline page are cached; authenticated data, uploads and worker jobs still require a connection.\n- **The worker control button needs a running control service.** Vercel cannot spawn a process on your PC or VPS; `pnpm worker:control` must be running and reachable via `WORKER_CONTROL_URL`.\n- **Timeline rendering, transcription, thumbnails and waveforms are local-only.** These jobs queue in Postgres and are produced by `pnpm worker`; Vercel can save and queue them but cannot process them.
- **Caption generation is manual and one-shot.** It replaces clips labeled `Auto caption` when regenerated; manually edited captions keep their own labels.
- **Large recordings use multipart uploads.** Files above 16MB split into 16MB parts with concurrency, per-part retry and progress. Interrupted uploads can be resumed from the session Media card by selecting the same file again; each track must remain under the 512MB video limit.
- **Camera/audio sync is manual.** Tracks start together, but drift or device latency can be corrected with the inspector's +/-100ms and +/-500ms nudges, a numeric offset, and source trim. There is no automatic audio/video alignment yet.
- **Platform-specific fields** for TikTok, YouTube and Threads (privacy, title, etc.) are not sent yet; verify drafts in Social Planner before scheduling.
- **No GitHub API sync.** Evidence is captured manually (commit/PR URLs, release notes).
- **No audience analytics import.** Views/likes/waitlist numbers are manual by design.
- **Single-user auth.**
- Free OpenRouter models are rate-limited (about 50 requests/day at low credit) and can be unavailable; failures are surfaced.
- Email OTP delivery requires a Resend API key. Without it, the password form is used.
- R2 jurisdictional buckets need an endpoint override that is not implemented yet.
- **Vercel commit-author gate:** a Git deployment is blocked before build (`TEAM_ACCESS_REQUIRED`) when the commit author is not a member of the Vercel team. Commit with an email tied to an authorized GitHub account (this repo uses `eazypickins001@gmail.com`), or invite the author in Vercel → Team → Members. This is not a build failure and not the old `UNKNOWN` symptom.

## First-use workflow

1. Create a project: problem, users, tone, platform list, publication exclusions.
2. Open **Publishing accounts**, load HighLevel accounts, select the targets, save.
3. Work as usual with a screen recorder running.
4. Capture a session: what you worked on, the problem, what changed, what failed, next task.
5. Add evidence: commit/PR links, release notes, screenshots, recordings, transcript excerpts. Mark what you verified.
6. Analyze the session. Review evidence gaps and unverified claims.
7. Generate only the formats you will publish (max 3 per batch).
8. Edit in the studio; every save creates a version. Fix quality warnings.
9. Approve the version. Approval alone publishes nothing.
10. Use **Publishing handoff** to create a HighLevel draft. Verify it in Social Planner. Enable real scheduling only when ready.

## Cost

| Service | Cost |
| --- | --- |
| Vercel Hobby | Free within limits |
| Neon free tier | Free within limits |
| Cloudflare R2 | 10GB free; requests beyond the free tier are paid |
| OpenRouter free models | $0, with daily/rate limits |
| HighLevel | Requires your existing subscription |
| FFmpeg / faster-whisper | Free, local |
