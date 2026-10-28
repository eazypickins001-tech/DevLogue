# Backup and restore runbook

Scope: the Neon Postgres database, the Cloudflare R2 bucket, environment secrets, and the render
worker. The worker keeps no durable state; `.worker.log` and `.worker-tmp/` are disposable.

Targets: RPO 24 hours for R2 (daily sync) and the plan's history window for Postgres; RTO about one
hour for a verified restore.

## What must be backed up

| Asset | Where | Why it matters |
| --- | --- | --- |
| Postgres rows | Neon | Projects, sessions, timelines, drafts, publishing records and storage keys |
| `media/`, `renders/`, `derivatives/` | R2 | Raw tracks, rendered videos and thumbnails |
| Secrets | Password manager / Vercel | `DATABASE_URL`, `APP_PASSWORD`, `R2_*`, `OPENROUTER_*`, `GHL_*`, `WORKER_CONTROL_*` |

R2 has no recycle bin: deleting a project removes its objects immediately. Without a separate backup
bucket the media is unrecoverable even if the database is restored.

## Postgres

### Point-in-time restore (preferred)

1. Open the Neon console, select the project, then **Branches → Restore**.
2. Create a branch from the timestamp before the incident (within the plan's history window).
3. Verify the branch with the queries below.
4. Point a preview deployment at the branch: update `DATABASE_URL`, redeploy, run
   `pnpm smoke:readonly` with `SMOKE_BASE_URL` set to the preview.
5. Swap production `DATABASE_URL` to the restored branch and redeploy. Keep the old branch until the
   new one is confirmed.

### Logical dump

Use a Postgres client version that matches Neon (17 or newer).

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
pg_dump $env:DATABASE_URL --format=custom --no-owner --file="devlogue-$stamp.dump"
```

Restore into a fresh Neon branch or database, never over production first:

```powershell
pg_restore --clean --if-exists --no-owner --dbname $env:RESTORE_DATABASE_URL "devlogue-$stamp.dump"
pnpm db:migrate   # only when the dump predates the current schema
```

Store dumps outside the repository and encrypt them if they leave your machine. A dump contains
project content, so treat it as confidential.

## R2

R2 objects are only as safe as the bucket copy. Keep a second bucket (or Backblaze B2/S3) and sync
daily.

With `rclone` (`r2:` and `r2-backup:` remotes configured with the S3 endpoint):

```powershell
rclone sync r2:devlogue-media r2-backup:devlogue-media --fast-list --transfers 16
```

With the AWS CLI:

```powershell
aws s3 sync "s3://$env:R2_BUCKET" "s3://$env:R2_BACKUP_BUCKET" `
  --endpoint-url "https://$env:R2_ACCOUNT_ID.r2.cloudflarestorage.com"
```

Restore carefully: syncing back with `--delete` would erase newer objects. Prefer restoring into a
temporary prefix, then copy only the keys you need:

```powershell
rclone copy r2-backup:devlogue-media/media/<userId>/ r2:devlogue-media/media/<userId>/ --include "*.webm"
```

Run `/operations/storage` afterwards to find orphaned objects and missing assets.

## Secrets

Keep a sealed copy of the production variables. Vercel is the source of truth for production;
`.env.local` is local only and must never be committed.

Rotate `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, `APP_PASSWORD`, `OPENROUTER_API_KEY`,
`GHL_*` and `WORKER_CONTROL_TOKEN` immediately if any value leaks. Update Vercel, `.env.local`, and
the worker/control service, then redeploy and restart the worker.

## Verification

Run against the restored database before switching traffic:

```sql
select count(*) from projects;
select count(*) from build_sessions;
select count(*) from media_assets;
select count(*) from timeline_projects;
select count(*) from content_drafts;
select count(*) from scheduled_posts;
```

Then confirm storage:

1. Pick three `media_assets.storage_key` values and confirm each object exists in R2.
2. Open one project, one session and one rendered timeline in the app.
3. Queue and finish a render with `pnpm worker`.
4. Create and remove a HighLevel draft in test mode (`GHL_TEST_MODE=true`).

## Incident playbooks

**Bad migration or deploy:** restore a Neon branch from before the change, verify, point a preview at
it, then swap production. Never run `db:migrate` against a branch you have not verified.

**Accidental project deletion:** restore the database to just before the deletion and restore the
matching R2 keys from the latest backup. Media created after the last sync may be lost; state the
gap in the incident record.

**R2 credential leak:** rotate the keys, update Vercel and the worker, redeploy, then audit the bucket
for unexpected objects.

**Total loss:** restore the latest dump and the most recent R2 sync, then accept the RPO gap. Record
the incident in `/operations/errors` and `docs/INCIDENT_LEDGER.md`.

## Drill schedule

Run a restore drill quarterly: dump the database, restore it into a branch, run the queries above,
spot-check R2 keys, and run the read-only smoke against a preview pointed at the branch. Record the
result and the time taken.
