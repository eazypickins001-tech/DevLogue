"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  buildSessions,
  contentDrafts,
  draftVersions,
  mediaAssets,
  projects,
  recordings,
  timelineProjects,
  timelineRenderJobs,
  transcriptionJobs,
  transcripts,
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

async function timelineForOwner(timelineId: string) {
  const owner = await getOwner();
  const db = getDb();
  const rows = await db
    .select()
    .from(timelineProjects)
    .where(and(eq(timelineProjects.id, timelineId), eq(timelineProjects.userId, owner.id)))
    .limit(1);
  return { db, owner, timeline: rows[0] ?? null };
}

export async function queueTimelineTranscription(formData: FormData): Promise<void> {
  await requireSession();
  const timelineId = formString(formData, "timelineId");
  const target = `/timelines/${timelineId}`;
  const { db, owner, timeline } = await timelineForOwner(timelineId);
  if (!timeline) redirectError("/timelines", "Timeline not found.");
  if (!timeline.recordingId) redirectError(target, "This timeline has no recording audio.");

  const audioAssets = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.userId, owner.id),
        eq(mediaAssets.recordingId, timeline.recordingId),
        inArray(mediaAssets.recordingTrack, ["microphone", "system"]),
      ),
    )
    .orderBy(mediaAssets.createdAt);
  const primary = audioAssets.find((asset) => asset.recordingTrack === "microphone") ?? audioAssets[0];
  if (!primary) redirectError(target, "No microphone or system-audio track is available.");

  const existingTranscript = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(eq(transcripts.mediaAssetId, primary.id))
    .limit(1);
  if (existingTranscript.length > 0) {
    redirectSuccess(target, "This recording already has a transcript.");
  }

  const active = await db
    .select({ id: transcriptionJobs.id })
    .from(transcriptionJobs)
    .where(
      and(
        eq(transcriptionJobs.mediaAssetId, primary.id),
        inArray(transcriptionJobs.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (active.length > 0) {
    redirectError(target, "Transcription is already queued or running.");
  }

  await db.insert(transcriptionJobs).values({ mediaAssetId: primary.id, status: "queued" });
  redirectSuccess(target, "Transcription queued. Start the worker with: pnpm worker");
}

export async function generateTimelineCaptions(formData: FormData): Promise<void> {
  await requireSession();
  const timelineId = formString(formData, "timelineId");
  const target = `/timelines/${timelineId}`;
  const { db, owner, timeline } = await timelineForOwner(timelineId);
  if (!timeline) redirectError("/timelines", "Timeline not found.");
  if (!timeline.recordingId) redirectError(target, "This timeline has no recording transcript.");

  const audioAssets = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.userId, owner.id),
        eq(mediaAssets.recordingId, timeline.recordingId),
        inArray(mediaAssets.recordingTrack, ["microphone", "system"]),
      ),
    );
  if (audioAssets.length === 0) redirectError(target, "No recording audio is available.");

  const transcriptRows = await db
    .select()
    .from(transcripts)
    .where(inArray(transcripts.mediaAssetId, audioAssets.map((asset) => asset.id)))
    .orderBy(desc(transcripts.createdAt))
    .limit(1);
  const transcript = transcriptRows[0];
  if (!transcript || transcript.segments.length === 0) {
    redirectError(target, "Transcribe the recording first, then generate captions.");
  }

  const captions = transcript.segments
    .filter((segment) => segment.text.trim().length > 0)
    .slice(0, 150)
    .map((segment) => ({
      startSec: Math.max(0, Number(segment.startSec)),
      durationSec: Math.max(0.5, Number(segment.endSec) - Number(segment.startSec)),
      text: segment.text.trim(),
    }));
  if (captions.length === 0) redirectError(target, "The transcript has no speech segments.");

  const document = structuredClone(timeline.document);
  const tracks = document.tracks.map((track) =>
    track.kind === "text"
      ? { ...track, clips: track.clips.filter((clip) => clip.label !== "Auto caption") }
      : track,
  );
  let textTrack = tracks.find((track) => track.kind === "text");
  if (!textTrack) {
    textTrack = {
      id: `track-text-${crypto.randomUUID()}`,
      kind: "text",
      name: "Captions",
      muted: false,
      hidden: false,
      clips: [],
    };
    tracks.push(textTrack);
  }

  const captionClips = captions.map((caption) => ({
    id: `clip-${crypto.randomUUID()}`,
    trackId: textTrack.id,
    kind: "text" as const,
    assetId: null,
    label: "Auto caption",
    startSec: caption.startSec,
    durationSec: caption.durationSec,
    sourceInSec: 0,
    sourceOutSec: null,
    volume: 1,
    muted: false,
    transform: null,
    text: {
      content: caption.text,
      fontSize: 42,
      color: "#ffffff",
      background: "rgba(15,23,42,0.7)",
      align: "center" as const,
      position: "bottom" as const,
    },
    transitionIn: "none" as const,
    transitionOut: "none" as const,
  }));
  textTrack.clips = [...textTrack.clips, ...captionClips];

  const next = normalizeTimeline({ ...document, tracks });
  await db
    .update(timelineProjects)
    .set({
      document: next,
      durationSeconds: next.durationSec.toFixed(2),
      version: timeline.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(timelineProjects.id, timeline.id));

  redirectSuccess(target, `Added ${captionClips.length} caption(s) from the transcript.`);
}

export async function createTimelineDraft(formData: FormData): Promise<void> {
  await requireSession();
  const timelineId = formString(formData, "timelineId");
  const target = `/timelines/${timelineId}`;
  const { db, owner, timeline } = await timelineForOwner(timelineId);
  if (!timeline) redirectError("/timelines", "Timeline not found.");
  if (timeline.draftId) redirectSuccess(`/studio/${timeline.draftId}`, "A draft is already linked to this timeline.");
  if (!timeline.projectId) redirectError(target, "This timeline has no project.");

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, timeline.projectId))
    .limit(1);
  const project = projectRows[0];
  if (!project) redirectError(target, "Project not found.");

  const jobRows = await db
    .select()
    .from(timelineRenderJobs)
    .where(
      and(
        eq(timelineRenderJobs.timelineId, timeline.id),
        eq(timelineRenderJobs.status, "succeeded"),
      ),
    )
    .orderBy(desc(timelineRenderJobs.createdAt))
    .limit(1);
  const job = jobRows[0];
  if (!job?.outputKey) redirectError(target, "Render the timeline before creating a draft.");

  const assetRows = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.userId, owner.id), eq(mediaAssets.storageKey, job.outputKey)))
    .limit(1);
  const asset = assetRows[0];
  if (!asset) redirectError(target, "The rendered video asset could not be found.");

  const captionText = timeline.document.tracks
    .flatMap((track) => track.clips)
    .filter((clip) => clip.label === "Auto caption" && clip.text)
    .map((clip) => clip.text!.content)
    .join(" ")
    .trim()
    .slice(0, 1800);
  const body = captionText || `Edited recording from ${timeline.title}.`;
  const targetPlatform = project.platforms[0] ?? "instagram";

  const inserted = await db
    .insert(contentDrafts)
    .values({
      projectId: project.id,
      sessionId: timeline.sessionId,
      format: "short_video",
      targetPlatform,
      title: timeline.title,
      body,
      payload: { timelineId: timeline.id, renderedMediaId: asset.id },
      status: "needs_review",
      currentVersion: 1,
    })
    .returning({ id: contentDrafts.id });
  const draft = inserted[0];
  if (!draft) redirectError(target, "Could not create the content draft.");

  await db.insert(draftVersions).values({
    draftId: draft.id,
    version: 1,
    title: timeline.title,
    body,
    payload: { timelineId: timeline.id, renderedMediaId: asset.id },
    source: "user",
  });
  await db
    .update(timelineProjects)
    .set({ draftId: draft.id, updatedAt: new Date() })
    .where(eq(timelineProjects.id, timeline.id));

  redirectSuccess(`/studio/${draft.id}`, "Content draft created from the rendered timeline.");
}
