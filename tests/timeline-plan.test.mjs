import { describe, expect, it } from "vitest";
import { buildTimelineArgs } from "../scripts/timeline-plan.mjs";

function document(overrides = {}) {
  return {
    version: 1,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    durationSec: 10,
    tracks: [
      {
        id: "video",
        kind: "video",
        name: "Screen",
        hidden: false,
        clips: [
          {
            id: "video-clip",
            kind: "video",
            assetId: "screen",
            startSec: 0,
            durationSec: 10,
            sourceInSec: 0,
            transform: null,
          },
        ],
      },
      {
        id: "camera",
        kind: "overlay",
        name: "Camera",
        hidden: false,
        clips: [
          {
            id: "camera-clip",
            kind: "overlay",
            assetId: "camera",
            startSec: 1,
            durationSec: 8,
            sourceInSec: 0,
            transform: {
              x: 0.7,
              y: 0.7,
              width: 0.2,
              height: 0.356,
              opacity: 1,
              cornerRadius: 0.18,
              mirror: true,
            },
          },
        ],
      },
      {
        id: "text",
        kind: "text",
        name: "Text",
        hidden: false,
        clips: [
          {
            id: "text-clip",
            kind: "text",
            assetId: null,
            startSec: 2,
            durationSec: 4,
            sourceInSec: 0,
            text: {
              content: "Build in public",
              fontSize: 48,
              color: "#ffffff",
              background: "rgba(15,23,42,0.65)",
              align: "center",
              position: "bottom",
            },
          },
        ],
      },
      {
        id: "mic",
        kind: "audio",
        name: "Microphone",
        hidden: false,
        clips: [
          {
            id: "mic-clip",
            kind: "audio",
            assetId: "mic",
            startSec: 0,
            durationSec: 10,
            sourceInSec: 0,
            volume: 0.8,
            muted: false,
          },
        ],
      },
      {
        id: "system",
        kind: "audio",
        name: "System",
        hidden: false,
        clips: [
          {
            id: "system-clip",
            kind: "audio",
            assetId: "system",
            startSec: 0,
            durationSec: 10,
            sourceInSec: 0,
            volume: 0.4,
            muted: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

const assetPaths = new Map([
  ["screen", "C:/tmp/screen.webm"],
  ["camera", "C:/tmp/camera.webm"],
  ["mic", "C:/tmp/mic.webm"],
  ["system", "C:/tmp/system.webm"],
]);

const textFiles = new Map([["text-clip", "C:/tmp/text-clip.txt"]]);

describe("buildTimelineArgs", () => {
  it("composites a screen track, camera PiP, caption and mixed audio", () => {
    const result = buildTimelineArgs({
      document: document(),
      assetPaths,
      textFiles,
      fontFile: "C:/Windows/Fonts/arial.ttf",
      outputPath: "C:/tmp/out.mp4",
    });
    const args = result.args.join(" ");

    expect(result).toMatchObject({ width: 1920, height: 1080, duration: 10, fps: 30 });
    expect(args).toContain("color=c=0x0F172A:s=1920x1080:r=30");
    expect(args).toContain("overlay=1344:696");
    expect(args).toContain("hflip");
    expect(args).toContain("drawtext=");
    expect(args).toContain("box=1");
    expect(args).toContain("enable='between(t,2,6)'");
    expect(args).toContain("amix=inputs=2");
    expect(args).toContain("-movflags +faststart");
    expect(args).toContain("C:/tmp/out.mp4");
  });

  it("omits a hidden camera overlay", () => {
    const input = document();
    input.tracks[1].hidden = true;
    const args = buildTimelineArgs({
      document: input,
      assetPaths,
      textFiles,
      fontFile: "C:/Windows/Fonts/arial.ttf",
      outputPath: "C:/tmp/out.mp4",
    }).args.join(" ");

    expect(args).not.toContain("overlay=1344:696");
    expect(args).toContain("drawtext=");
  });

  it("uses portrait output dimensions", () => {
    const input = document({ aspectRatio: "9:16", width: 1080, height: 1920 });
    const args = buildTimelineArgs({
      document: input,
      assetPaths,
      textFiles,
      fontFile: "C:/Windows/Fonts/arial.ttf",
      outputPath: "C:/tmp/out.mp4",
    }).args.join(" ");

    expect(args).toContain("s=1080x1920");
    expect(args).toContain("pad=1080:1920");
  });

  it("adds silence when the timeline has no audio clips", () => {
    const input = document();
    input.tracks = input.tracks.filter((track) => track.kind !== "audio");
    const args = buildTimelineArgs({
      document: input,
      assetPaths,
      textFiles,
      fontFile: "C:/Windows/Fonts/arial.ttf",
      outputPath: "C:/tmp/out.mp4",
    }).args.join(" ");

    expect(args).toContain("anullsrc=r=48000:cl=stereo");
    expect(args).toContain("[aout]");
  });

  it("rejects a timeline without tracks", () => {
    expect(() =>
      buildTimelineArgs({
        document: {},
        assetPaths,
        textFiles,
        fontFile: "C:/Windows/Fonts/arial.ttf",
        outputPath: "C:/tmp/out.mp4",
      }),
    ).toThrow(/no tracks/i);
  });
});
