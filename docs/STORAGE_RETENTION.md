# Storage and retention

DevLogue stores raw recordings, renders, thumbnails and waveforms in Cloudflare R2. This page explains how to inspect usage and safely remove objects that are no longer referenced by the database.

## Visibility

- **Settings -> Storage** shows recorded bytes by media kind, largest projects and largest sessions. Sizes come from `media_assets`.
- **Project delete** shows how many recorded bytes and assets will be removed from R2 before you confirm.
- **Settings -> Open R2 storage audit** (`/operations/storage`) lists live R2 objects under:
  - `media/`
  - `renders/`
  - `derivatives/`

The audit compares R2 keys with:

- `media_assets.storage_key`
- `media_assets.thumbnail_key`
- `media_assets.waveform_key`
- `multipart_uploads.key`

Objects outside those prefixes are ignored. Database-backed keys are never treated as orphans.

## Warning threshold

Set `STORAGE_WARNING_BYTES` (default 8 GiB) to show storage warnings on Record and Settings before the bucket becomes full.

## Retention cleanup

Set `MEDIA_RETENTION_DAYS` (default 90) to control the retention window. `/operations/storage` shows a **Retention cleanup** card that previews and deletes two kinds of old data:

- **Raw recording tracks** older than the window that no timeline or storyboard references.
- **Superseded renders** older than the window. The latest successful render for each timeline and each draft is always kept.

Eligibility is conservative:

- Raw tracks must belong to a recording (`recording_id` is set), be older than the cutoff, and not be referenced by any timeline or storyboard scene.
- Renders must be succeeded jobs older than the cutoff and must not be the newest succeeded render for their timeline or draft.

Uploaded evidence media, thumbnails and waveforms attached to kept assets are not part of this cleanup. Deleting an item also removes its thumbnail and waveform. There is still no automatic purge job.

## Safe cleanup

1. Click **Scan R2 for orphans**. This is read-only.
2. Review the key list and total orphan bytes.
3. Click **Delete N orphans** and confirm.
4. The server re-reads the database before deleting each key. Only keys under the audited prefixes are eligible.
5. Rescan after cleanup.

Deletion is irreversible. Take an R2 backup or export the key list before a broad cleanup.

## Retention policy

There is no automatic deletion of application media. Decide explicitly per project/session. Recommended manual policy:

- Keep raw screen/camera/microphone tracks while a project is active.
- Keep the latest successful render per timeline.
- Remove superseded renders after a new render is verified.
- Remove raw tracks after publishing is complete and no further edits are planned.
- Keep thumbnails/waveforms with their parent asset; they are removed when the asset is deleted.

Error-ledger events are separate: raw error events use 90-day retention and are pruned by Vercel Cron; incidents and audit history are retained.

## R2 lifecycle suggestion

Cloudflare R2 lifecycle rules can expire a dedicated archival prefix (for example `archive/`) after a chosen number of days. Do **not** put `media/`, `renders/` or `derivatives/` on an automatic expiry rule unless you have verified that the application deletes its database rows first. Small files and derivatives are cheap; raw recordings are the main storage cost.

## Commands

```powershell
# Storage DB summary is available in Settings.
# R2 orphan audit is available at /operations/storage.

# Error event retention fallback:
pnpm prune:errors
```
