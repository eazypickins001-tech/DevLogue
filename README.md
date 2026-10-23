# DevLogue

Build in public from real work. DevLogue turns documented development sessions into evidence-based social content, storyboards and approved posts — without inventing results.

The original product brief lives in [`docs/PROJECT_PROMPT.md`](docs/PROJECT_PROMPT.md). Architecture decisions are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What works today

- Multi-project workspace with stage, audience, positioning, exclusions and platform preferences.
- Build-session capture: manual notes, structured evidence (commits, PRs, releases, issues, notes).
- Private media uploads to Cloudflare R2 with presigned PUT, size/type validation and magic-byte checks.
- AI session analysis with Zod-validated structured output, evidence gaps and per-claim evidence references.
- On-demand content generation (max 3 formats per batch) for 14 formats including captions, threads, outlines, changelog and short-video storyboards.
- Storyboards with scene durations normalized to the target runtime and scenes mapped to uploaded assets.
- Versioned drafts: AI output, your edits, and the approved version are separate records.
- Deterministic quality checks: platform limits, generic-phrase warnings, hype punctuation, unsupported numbers.
- Approval workflow that never publishes anything automatically.
- Content studio, publishing calendar handoff view, feedback inbox, analytics from your own data, integration status and read-only connection checks.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript | Vercel-native, server actions for mutations |
| Styling | Tailwind CSS 4 | No component dependency, small surface |
| Database | Neon Postgres via `@neondatabase/serverless` + Drizzle ORM | Free tier, HTTP driver, no Prisma engine on serverless |
| Storage | Cloudflare R2 (S3 API) via `aws4fetch` | 10GB free, no egress fees, presigned URLs |
| AI | OpenRouter or any OpenAI-compatible endpoint | Provider-agnostic, per-task model selection |
| Auth | Single password + HMAC-signed cookie | Free, adequate for a single-user workspace |
| Tests | Vitest | Fast unit tests for pure logic |

Media processing (FFmpeg/Whisper) is intentionally **not** part of the web request path. See limitations.

## Requirements

- Node.js 22+
- pnpm 10+
- A free [Neon](https://neon.tech) Postgres project
- A Cloudflare account with an R2 bucket (optional until you upload media)
- An OpenRouter API key or an OpenAI-compatible endpoint (optional until you analyze/generate)

## Local setup

```powershell
pnpm install
Copy-Item .env.example .env.local
```

Generate an auth secret:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Fill `.env.local`:

```dotenv
APP_PASSWORD=<a long password you will remember>
AUTH_SECRET=<paste the generated value>
OWNER_EMAIL=you@example.com
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
```

Apply the database schema:

```powershell
pnpm db:migrate
```

Start the app:

```powershell
pnpm dev
```

Open `http://localhost:3000`, sign in, create a project, then capture a session.

### Cloudflare R2 (optional, for uploads)

1. Create a bucket.
2. Create an R2 API token with **Object Read & Write** scoped to that bucket.
3. Add to `.env.local`:

```dotenv
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=devlogue-media
```

4. Add a CORS policy on the bucket (allowed origins must include your app origin):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Uploads are private. The app serves them through `/api/media/[id]`, which checks the session cookie and redirects to a 5-minute signed URL.

### AI provider

OpenRouter:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
AI_MODEL=openai/gpt-4o-mini
AI_MODEL_ANALYSIS=openai/gpt-4o-mini
AI_MODEL_CONTENT=openai/gpt-4o-mini
```

Any OpenAI-compatible endpoint:

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-host/v1
AI_API_KEY=...
AI_MODEL=...
```

Models are never hardcoded. If no model is configured, analysis and generation fail with an explicit message instead of guessing. Token usage is recorded; cost is stored only when the provider returns it.

### GoHighLevel (optional, phase 4)

Create a Private Integration Token with Social Planner scopes, then:

```dotenv
GHL_API_TOKEN=...
GHL_LOCATION_ID=...
GHL_USER_ID=...
GHL_DEFAULT_ACCOUNT_IDS=
GHL_TEST_MODE=true
```

Verified endpoints used by the adapter design:

- `GET https://services.leadconnectorhq.com/social-media-posting/{locationId}/accounts`
- `POST https://services.leadconnectorhq.com/social-media-posting/{locationId}/posts` with header `Version: 2021-07-28`

The create-post body requires `accountIds`, `type` and `userId`; `summary`, `media`, `scheduleDate` and `status` (`draft`/`scheduled`/`published`) are optional. **This build does not schedule live posts.** Approved drafts are shown in the calendar for manual handoff until credentials and account IDs are verified. There is no silent fallback to fake publishing.

## Quality gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Import the repo in Vercel (framework preset: Next.js; no build overrides needed).
3. Add the environment variables from `.env.local` in Vercel Project Settings.
4. Run migrations against the production database once from your machine:
   ```powershell
   $env:DATABASE_URL="postgresql://..."; pnpm db:migrate
   ```
5. Deploy. Update the R2 CORS policy with the production origin.

Server actions call AI providers sequentially. On Vercel Hobby (60s function limit), keep content batches small; the UI caps a batch at 3 formats.

## Data, privacy and retention

- AI prompts contain session text and evidence text only. Media files are never sent to the AI provider by this app.
- Project `sensitiveNotes` are shown only in the UI and are not included in prompts; `publicationExclusions` are project context.
- Uploaded assets are private by default and served through an authenticated route.
- Deleting a project cascades sessions, evidence, drafts and feedback in Postgres. R2 objects must be deleted per asset (the media delete action removes both).
- There is no automatic purge job. Delete data explicitly.

## Known limitations

- **No automated video rendering.** Storyboards, scene-to-asset mapping and editing instructions are complete; assembly requires FFmpeg/Whisper locally. Neither is installed on this machine.
- **No live publishing.** GHL scheduling is implemented as a documented adapter target with handoff UI, gated on verified credentials.
- **No audience analytics import.** Views/likes/waitlist numbers are manual; the analytics page says so.
- **No GitHub API sync yet.** Evidence is captured manually (commit URLs, PR links, release notes). This avoids storing a GitHub token and keeps the first version dependency-free.
- **Single-user auth.** The schema keeps `userId` so multi-user can be added without a rewrite.
- Content regeneration keeps old versions but does not diff them visually.

## First-use workflow

1. Create a project: problem, target users, tone, platform list, publication exclusions.
2. Work as usual with a screen recorder running.
3. Capture a session: what you worked on, the problem, what changed, what failed, next task.
4. Add evidence: commit/PR links, release notes, screenshots, recordings, transcript excerpts. Mark verified items.
5. Analyze the session. Review evidence gaps and unverified claims.
6. Generate only the formats you will publish (max 3 per batch).
7. Edit in the studio; every save creates a version. Fix quality warnings.
8. Approve the version. Nothing is published by approving.
9. Use the calendar handoff view to schedule in HighLevel or publish manually.

## Cost

| Service | Cost |
| --- | --- |
| Vercel Hobby | Free |
| Neon free tier | Free within limits |
| Cloudflare R2 | 10GB storage free; requests/past free tier are paid |
| OpenRouter | Pay per token; exact price depends on the chosen model |
| GoHighLevel | Requires your existing subscription |
| FFmpeg / Whisper | Free, local |
