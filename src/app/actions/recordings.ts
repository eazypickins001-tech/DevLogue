"use server";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  buildSessions,
  mediaAssets,
  recordings,
  timelineProjects,
  timelineRenderJobs,
} from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { isStorageConfigured } from "@/lib/storage";
import { formString } from "@/lib/validation";
import {
  CAMERA_POSITIONS,
  CAMERA_SIZES,
  RECORDING_ASPECTS,
  RECORDING_SOURCES,
  outputSize,
  type CameraPosition,
  type CameraSize,
  type RecordingAspect,
  type RecordingSource,
  type RecordingTrackName,
} from "@/lib/recording/types";
import { createRecordingTimeline, normalizeTimeline, type TimelineDocument } from "@/lib/timeline/model";

type TrackInput = {
  assetId: string;
  track: RecordingTrackName;
};

export type CreateRecordingInput = {
  sessionId: string;
  title?: string;
  durationSec: number;
  source: RecordingSource;
  aspectRatio: RecordingAspect;
  fps: number;
  cameraVisible: boolean;
  cameraPosition: CameraPosition;
  cameraSize: CameraSize;
  mirrorCamera: boolean;
  tracks: TrackInput[];
};

export type CreateRecordingResult =
  | { ok: true; recordingId: string; timelineId: string }
  | { ok: false; error: string };

function validTrackName(value: string): value is RecordingTrackName {
  return ["screen", "camera", "microphone", "system"].includes(value);
}

export async function createRecording(input: CreateRecordingInput): Promise<CreateRecordingResult> {
  await requireSession();
  const owner = await getOwner();
  const db = getDb();

  if (!RECORDING_SOURCES.includes(input.source)) {
    return { ok: false, error: "Unknown recording source." };
  }
  if (!RECORDING_ASPECTS.includes(input.aspectRatio)) {
    return { ok: false, error: "Unknown recording format." };
  }
  if (!CAMERA_POSITIONS.includes(input.cameraPosition) || !CAMERA_SIZES.includes(input.cameraSize)) {
    return { ok: false, error: "Unknown camera layout." };
  }
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    return { ok: false, error: "Recording duration is missing." };
  }

  const sessionRows = await db
    .select()
    .from(buildSessions)
    .where(and(eq(buildSessions.id, input.sessionId), eq(buildSessions.userId, owner.id)))
    .limit(1);
  const session = sessionRows[0];
  if (!session) return { ok: false, error: "Session not found." };

  const tracks = input.tracks.filter(
    (track): track is TrackInput => Boolean(track.assetId) && validTrackName(track.track),
  );
  if (tracks.length === 0) return { ok: false, error: "No recording tracks were provided." };
  if (new Set(tracks.map((track) => track.track)).size !== tracks.length) {
    return { ok: false, error: "Each recording track can only be saved once." };
  }

  const assetRows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.userId, owner.id),
        eq(mediaAssets.sessionId, input.sessionId),
        inArray(
          mediaAssets.id,
          tracks.map((track) => track.assetId),
        ),
      ),
    );
  if (assetRows.length !== tracks.length) {
    return { ok: false, error: "One or more uploaded tracks could not be found." };
  }

  const assetMap = new Map(assetRows.map((asset) => [asset.id, asset]));
  for (const track of tracks) {
    const asset = assetMap.get(track.assetId);
    if (!asset) return { ok: false, error: "An uploaded track could not be found." };
    const expectedKind = track.track === "screen" || track.track === "camera" ? "video" : "audio";
    if (asset.kind !== expectedKind) {
      return { ok: false, error: `The ${track.track} track has the wrong media type.` };
    }
  }

  const title = input.title?.trim() || `${session.title} recording`;
  const inserted = await db
    .insert(recordings)
    .values({
      userId: owner.id,
      projectId: session.projectId,
      sessionId: session.id,
      title,
      source: input.source,
      aspectRatio: input.aspectRatio,
      cameraVisible: input.cameraVisible,
      durationSeconds: input.durationSec.toFixed(2),
      status: "ready",
    })
    .returning({ id: recordings.id });
  const recording = inserted[0];
  if (!recording) return { ok: false, error: "Could not create the recording." };

  for (const track of tracks) {
    await db
      .update(mediaAssets)
      .set({ recordingId: recording.id, recordingTrack: track.track })
      .where(and(eq(mediaAssets.id, track.assetId), eq(mediaAssets.userId, owner.id)));
  }

  const byTrack = new Map(tracks.map((track) => [track.track, track.assetId]));
  const document = createRecordingTimeline({
    aspectRatio: input.aspectRatio,
    durationSec: input.durationSec,
    fps: [24, 30, 60].includes(input.fps) ? input.fps : 30,
    source: input.source,
    screenAssetId: byTrack.get("screen") ?? null,
    cameraAssetId: byTrack.get("camera") ?? null,
    microphoneAssetId: byTrack.get("microphone") ?? null,
    systemAssetId: byTrack.get("system") ?? null,
    cameraVisible: input.cameraVisible,
    cameraPosition: input.cameraPosition,
    cameraSize: input.cameraSize,
    mirrorCamera: input.mirrorCamera,
  });

  const timeline = await db
    .insert(timelineProjects)
    .values({
      userId: owner.id,
      projectId: session.projectId,
      sessionId: session.id,
      recordingId: recording.id,
      title,
      aspectRatio: document.aspectRatio,
      width: document.width,
      height: document.height,
      fps: document.fps,
      durationSeconds: document.durationSec.toFixed(2),
      document,
      status: "draft",
    })
    .returning({ id: timelineProjects.id });

  const timelineRow = timeline[0];
  if (!timelineRow) return { ok: false, error: "Could not create the timeline." };

  return { ok: true, recordingId: recording.id, timelineId: timelineRow.id };
}

export type SaveTimelineResult = { ok: true; version: number } | { ok: false; error: string };

export async function saveTimeline(input: {
  timelineId: string;
  document: TimelineDocument;
}): Promise<SaveTimelineResult> {
  await requireSession();
  const owner = await getOwner();
  const db = getDb();

  const rows = await db
    .select()
    .from(timelineProjects)
    .where(and(eq(timelineProjects.id, input.timelineId), eq(timelineProjects.userId, owner.id)))
    .limit(1);
  const current = rows[0];
  if (!current) return { ok: false, error: "Timeline not found." };
  if (!input.document || !Array.isArray(input.document.tracks)) {
    return { ok: false, error: "Timeline document is invalid." };
  }
  if (input.document.tracks.length > 20) {
    return { ok: false, error: "The timeline has too many tracks." };
  }

  let document: TimelineDocument;
  try {
    document = normalizeTimeline(input.document);
  } catch {
    return { ok: false, error: "Timeline document is invalid." };
  }
  if (!RECORDING_ASPECTS.includes(document.aspectRatio)) {
    return { ok: false, error: "Unknown timeline format." };
  }
  const size = outputSize(document.aspectRatio);
  document = {
    ...document,
    width: size.width,
    height: size.height,
    fps: [24, 30, 60].includes(document.fps) ? document.fps : 30,
  };
  if (document.tracks.some((track) => track.clips.length > 200)) {
    return { ok: false, error: "A track has too many clips." };
  }

  const assetIds = [
    ...new Set(
      document.tracks.flatMap((track) =>
        track.clips.map((clip) => clip.assetId).filter((assetId): assetId is string => Boolean(assetId)),
      ),
    ),
  ];
  if (assetIds.length > 0) {
    if (!current.recordingId) {
      return { ok: false, error: "Timeline media is not linked to a recording." };
    }
    const ownedAssets = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.userId, owner.id),
          eq(mediaAssets.recordingId, current.recordingId),
          inArray(mediaAssets.id, assetIds),
        ),
      );
    if (ownedAssets.length !== assetIds.length) {
      return { ok: false, error: "Timeline references media outside this recording." };
    }
  }

  const version = current.version + 1;
  await db
    .update(timelineProjects)
    .set({
      document,
      aspectRatio: document.aspectRatio,
      width: document.width,
      height: document.height,
      fps: document.fps,
      durationSeconds: document.durationSec.toFixed(2),
      version,
      updatedAt: new Date(),
    })
    .where(eq(timelineProjects.id, current.id));

  return { ok: true, version };
}

export async function queueTimelineRender(formData: FormData): Promise<void> {
  await requireSession();
  const timelineId = formString(formData, "timelineId");
  const target = `/timelines/${timelineId}`;
  if (!isStorageConfigured()) {
    redirectError(target, "R2 is not configured, so the rendered file cannot be stored.");
  }

  const owner = await getOwner();
  const db = getDb();
  const rows = await db
    .select({ id: timelineProjects.id })
    .from(timelineProjects)
    .where(and(eq(timelineProjects.id, timelineId), eq(timelineProjects.userId, owner.id)))
    .limit(1);
  if (rows.length === 0) redirectError("/timelines", "Timeline not found.");

  const active = await db
    .select({ id: timelineRenderJobs.id })
    .from(timelineRenderJobs)
    .where(
      and(
        eq(timelineRenderJobs.timelineId, timelineId),
        inArray(timelineRenderJobs.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (active.length > 0) {
    redirectError(target, "A render is already queued or running for this timeline.");
  }

  await db.insert(timelineRenderJobs).values({ timelineId, status: "queued" });
  redirectSuccess(target, "Timeline render queued. Start the worker with: pnpm worker");
}
