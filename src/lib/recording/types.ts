export const RECORDING_ASPECTS = ["16:9", "9:16"] as const;
export type RecordingAspect = (typeof RECORDING_ASPECTS)[number];

export const RECORDING_SOURCES = ["screen-camera", "screen", "camera"] as const;
export type RecordingSource = (typeof RECORDING_SOURCES)[number];

export const CAMERA_MODES = ["off", "record", "pip"] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export const CAMERA_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export type CameraPosition = (typeof CAMERA_POSITIONS)[number];

export const CAMERA_SIZES = ["sm", "md", "lg"] as const;
export type CameraSize = (typeof CAMERA_SIZES)[number];

export type RecordingTrackName = "screen" | "camera" | "microphone" | "system";

export type RecordingOptions = {
  source: RecordingSource;
  aspect: RecordingAspect;
  cameraMode: CameraMode;
  cameraPosition: CameraPosition;
  cameraSize: CameraSize;
  mirrorCamera: boolean;
  microphone: boolean;
  systemAudio: boolean;
  frameRate: 30 | 60;
  screenQuality: "720p" | "1080p";
  cameraQuality: "480p" | "720p" | "1080p";
};

export type RecordingTrack = {
  name: RecordingTrackName;
  blob: Blob;
  mimeType: string;
  cleanup?: () => Promise<void>;
};

export type RecordingResult = {
  durationSec: number;
  tracks: RecordingTrack[];
};

export type CaptureStreams = {
  display: MediaStream | null;
  camera: MediaStream | null;
  microphone: MediaStream | null;
};

export const DEFAULT_RECORDING_OPTIONS: RecordingOptions = {
  source: "screen-camera",
  aspect: "16:9",
  cameraMode: "pip",
  cameraPosition: "bottom-right",
  cameraSize: "md",
  mirrorCamera: true,
  microphone: true,
  systemAudio: true,
  frameRate: 30,
  screenQuality: "1080p",
  cameraQuality: "720p",
};

export const RECORDING_TRACK_LABELS: Record<RecordingTrackName, string> = {
  screen: "Screen video",
  camera: "Camera video",
  microphone: "Microphone",
  system: "System audio",
};

export function outputSize(aspect: RecordingAspect): { width: number; height: number } {
  return aspect === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
}

export function previewSize(aspect: RecordingAspect): { width: number; height: number } {
  return aspect === "16:9" ? { width: 960, height: 540 } : { width: 540, height: 960 };
}

export function cameraRect(
  aspect: RecordingAspect,
  position: CameraPosition,
  size: CameraSize,
): { x: number; y: number; width: number; height: number } {
  const { width: outputWidth, height: outputHeight } = outputSize(aspect);
  const widthFraction =
    aspect === "16:9"
      ? { sm: 0.14, md: 0.2, lg: 0.28 }[size]
      : { sm: 0.2, md: 0.28, lg: 0.36 }[size];
  const heightFraction = (widthFraction * outputWidth) / outputHeight;
  const margin = 0.035;

  return {
    x: position.endsWith("right") ? 1 - margin - widthFraction : margin,
    y: position.startsWith("bottom") ? 1 - margin - heightFraction : margin,
    width: widthFraction,
    height: heightFraction,
  };
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
