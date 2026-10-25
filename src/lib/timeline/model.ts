import {
  cameraRect,
  outputSize,
  type CameraPosition,
  type CameraSize,
  type RecordingAspect,
  type RecordingSource,
} from "@/lib/recording/types";

export const TIMELINE_VERSION = 1;

export type TimelineAspect = RecordingAspect;
export type TimelineTrackKind = "video" | "overlay" | "text" | "audio";
export type TimelineTransition = "none" | "fade";

export type TimelineTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  cornerRadius: number;
  mirror: boolean;
};

export type TimelineText = {
  content: string;
  fontSize: number;
  color: string;
  background: string | null;
  align: "left" | "center" | "right";
  position: "top" | "center" | "bottom";
};

export type TimelineClip = {
  id: string;
  trackId: string;
  kind: TimelineTrackKind;
  assetId: string | null;
  label: string;
  startSec: number;
  durationSec: number;
  sourceInSec: number;
  sourceOutSec: number | null;
  volume: number;
  muted: boolean;
  transform: TimelineTransform | null;
  text: TimelineText | null;
  transitionIn: TimelineTransition;
  transitionOut: TimelineTransition;
};

export type TimelineTrack = {
  id: string;
  kind: TimelineTrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  clips: TimelineClip[];
};

export type TimelineDocument = {
  version: typeof TIMELINE_VERSION;
  aspectRatio: TimelineAspect;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  tracks: TimelineTrack[];
};

export type RecordingTimelineInput = {
  aspectRatio: TimelineAspect;
  durationSec: number;
  fps: number;
  source: RecordingSource;
  screenAssetId: string | null;
  cameraAssetId: string | null;
  microphoneAssetId: string | null;
  systemAssetId: string | null;
  cameraVisible: boolean;
  cameraPosition: CameraPosition;
  cameraSize: CameraSize;
  mirrorCamera: boolean;
};

const FULL_FRAME: TimelineTransform = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  opacity: 1,
  cornerRadius: 0,
  mirror: false,
};

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? Math.random().toString(36).slice(2)}`;
}

export function timelineDuration(tracks: TimelineTrack[]): number {
  return tracks.reduce((total, track) => {
    const trackEnd = track.clips.reduce(
      (end, clip) => Math.max(end, clip.startSec + clip.durationSec),
      0,
    );
    return Math.max(total, trackEnd);
  }, 0);
}

export function normalizeTimeline(document: TimelineDocument): TimelineDocument {
  const tracks = document.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({
      ...clip,
      startSec: Math.max(0, clip.startSec),
      durationSec: Math.max(0.05, clip.durationSec),
      sourceInSec: Math.max(0, clip.sourceInSec),
      volume: Math.min(1, Math.max(0, clip.volume)),
    })),
  }));
  return {
    ...document,
    durationSec: timelineDuration(tracks),
    tracks,
  };
}

export function createRecordingTimeline(input: RecordingTimelineInput): TimelineDocument {
  const { width, height } = outputSize(input.aspectRatio);
  const durationSec = Math.max(0.1, input.durationSec);
  const tracks: TimelineTrack[] = [];

  const videoTrack: TimelineTrack = {
    id: createId("track-video"),
    kind: "video",
    name: input.source === "camera" ? "Camera" : "Screen",
    muted: false,
    hidden: false,
    clips: [],
  };

  if (input.source === "camera" && input.cameraAssetId) {
    videoTrack.clips.push({
      id: createId("clip"),
      trackId: videoTrack.id,
      kind: "video",
      assetId: input.cameraAssetId,
      label: "Camera",
      startSec: 0,
      durationSec,
      sourceInSec: 0,
      sourceOutSec: null,
      volume: 0,
      muted: true,
      transform: { ...FULL_FRAME, mirror: input.mirrorCamera },
      text: null,
      transitionIn: "none",
      transitionOut: "none",
    });
  } else if (input.screenAssetId) {
    videoTrack.clips.push({
      id: createId("clip"),
      trackId: videoTrack.id,
      kind: "video",
      assetId: input.screenAssetId,
      label: "Screen",
      startSec: 0,
      durationSec,
      sourceInSec: 0,
      sourceOutSec: null,
      volume: 0,
      muted: true,
      transform: FULL_FRAME,
      text: null,
      transitionIn: "none",
      transitionOut: "none",
    });
  }

  if (videoTrack.clips.length > 0) tracks.push(videoTrack);

  if (input.source !== "camera" && input.cameraAssetId) {
    const rect = cameraRect(input.aspectRatio, input.cameraPosition, input.cameraSize);
    tracks.push({
      id: createId("track-camera"),
      kind: "overlay",
      name: "Camera",
      muted: false,
      hidden: !input.cameraVisible,
      clips: [
        {
          id: createId("clip"),
          trackId: "",
          kind: "overlay",
          assetId: input.cameraAssetId,
          label: "Camera",
          startSec: 0,
          durationSec,
          sourceInSec: 0,
          sourceOutSec: null,
          volume: 0,
          muted: true,
          transform: {
            ...rect,
            opacity: 1,
            cornerRadius: 0.18,
            mirror: input.mirrorCamera,
          },
          text: null,
          transitionIn: "none",
          transitionOut: "none",
        },
      ],
    });
    const cameraTrack = tracks[tracks.length - 1];
    cameraTrack.clips[0].trackId = cameraTrack.id;
  }

  tracks.push({
    id: createId("track-text"),
    kind: "text",
    name: "Text",
    muted: false,
    hidden: false,
    clips: [],
  });

  if (input.systemAssetId) {
    tracks.push({
      id: createId("track-system"),
      kind: "audio",
      name: "System audio",
      muted: false,
      hidden: false,
      clips: [
        {
          id: createId("clip"),
          trackId: "",
          kind: "audio",
          assetId: input.systemAssetId,
          label: "System audio",
          startSec: 0,
          durationSec,
          sourceInSec: 0,
          sourceOutSec: null,
          volume: 1,
          muted: false,
          transform: null,
          text: null,
          transitionIn: "none",
          transitionOut: "none",
        },
      ],
    });
    const audioTrack = tracks[tracks.length - 1];
    audioTrack.clips[0].trackId = audioTrack.id;
  }

  if (input.microphoneAssetId) {
    tracks.push({
      id: createId("track-mic"),
      kind: "audio",
      name: "Microphone",
      muted: false,
      hidden: false,
      clips: [
        {
          id: createId("clip"),
          trackId: "",
          kind: "audio",
          assetId: input.microphoneAssetId,
          label: "Microphone",
          startSec: 0,
          durationSec,
          sourceInSec: 0,
          sourceOutSec: null,
          volume: 1,
          muted: false,
          transform: null,
          text: null,
          transitionIn: "none",
          transitionOut: "none",
        },
      ],
    });
    const audioTrack = tracks[tracks.length - 1];
    audioTrack.clips[0].trackId = audioTrack.id;
  }

  return normalizeTimeline({
    version: TIMELINE_VERSION,
    aspectRatio: input.aspectRatio,
    width,
    height,
    fps: input.fps,
    durationSec,
    tracks,
  });
}
