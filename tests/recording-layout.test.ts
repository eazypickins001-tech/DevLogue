import { describe, expect, it } from "vitest";
import {
  cameraRect,
  formatBytes,
  formatDuration,
  outputSize,
  previewSize,
} from "../src/lib/recording/types";
import { createRecordingTimeline, timelineDuration } from "../src/lib/timeline/model";

describe("recording layout", () => {
  it("returns landscape and portrait output sizes", () => {
    expect(outputSize("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(outputSize("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(previewSize("16:9")).toEqual({ width: 960, height: 540 });
    expect(previewSize("9:16")).toEqual({ width: 540, height: 960 });
  });

  it("keeps the camera PiP square in pixels", () => {
    const landscape = cameraRect("16:9", "bottom-right", "md");
    expect(landscape.width * 1920).toBeCloseTo(landscape.height * 1080);
    const portrait = cameraRect("9:16", "top-left", "lg");
    expect(portrait.width * 1080).toBeCloseTo(portrait.height * 1920);
  });

  it("formats durations and bytes", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});

describe("recording timeline", () => {
  it("adds screen, visible camera, and both audio tracks", () => {
    const timeline = createRecordingTimeline({
      aspectRatio: "16:9",
      durationSec: 30,
      fps: 30,
      source: "screen-camera",
      screenAssetId: "screen-1",
      cameraAssetId: "camera-1",
      microphoneAssetId: "mic-1",
      systemAssetId: "system-1",
      cameraVisible: true,
      cameraPosition: "bottom-right",
      cameraSize: "md",
      mirrorCamera: true,
    });

    expect(timeline.tracks.map((track) => track.kind)).toEqual([
      "video",
      "overlay",
      "text",
      "audio",
      "audio",
    ]);
    const cameraTrack = timeline.tracks.find((track) => track.kind === "overlay");
    expect(cameraTrack?.hidden).toBe(false);
    expect(cameraTrack?.clips[0].transform?.mirror).toBe(true);
    expect(timelineDuration(timeline.tracks)).toBe(30);
  });

  it("records a hidden camera as an overlay track", () => {
    const timeline = createRecordingTimeline({
      aspectRatio: "9:16",
      durationSec: 12,
      fps: 30,
      source: "screen-camera",
      screenAssetId: "screen-1",
      cameraAssetId: "camera-1",
      microphoneAssetId: null,
      systemAssetId: null,
      cameraVisible: false,
      cameraPosition: "top-right",
      cameraSize: "sm",
      mirrorCamera: false,
    });

    const cameraTrack = timeline.tracks.find((track) => track.kind === "overlay");
    expect(cameraTrack?.hidden).toBe(true);
    expect(timeline.tracks.some((track) => track.kind === "audio")).toBe(false);
  });

  it("uses the camera as the main clip for camera-only recording", () => {
    const timeline = createRecordingTimeline({
      aspectRatio: "16:9",
      durationSec: 8,
      fps: 30,
      source: "camera",
      screenAssetId: null,
      cameraAssetId: "camera-1",
      microphoneAssetId: "mic-1",
      systemAssetId: null,
      cameraVisible: false,
      cameraPosition: "bottom-right",
      cameraSize: "md",
      mirrorCamera: true,
    });

    expect(timeline.tracks[0].kind).toBe("video");
    expect(timeline.tracks[0].clips[0].assetId).toBe("camera-1");
    expect(timeline.tracks.some((track) => track.kind === "overlay")).toBe(false);
  });
});
