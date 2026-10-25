import { describe, expect, it } from "vitest";
import {
  parseWhisperJson,
  planScenes,
  sceneFilterArgs,
  sceneInputArgs,
  wrapText,
} from "../scripts/render-plan.mjs";

describe("wrapText", () => {
  it("wraps words at the character limit", () => {
    expect(wrapText("one two three four five", 9)).toBe("one two\nthree\nfour five");
  });

  it("caps output at four lines", () => {
    const lines = wrapText("a b c d e f g h i j k l", 1).split("\n");
    expect(lines.length).toBe(4);
  });

  it("handles empty input", () => {
    expect(wrapText("", 10)).toBe("");
  });
});

describe("planScenes", () => {
  it("computes cumulative start times", () => {
    const scenes = planScenes([
      { durationSec: 5, onScreenText: "A", narration: "first" },
      { durationSec: 7, onScreenText: "B", narration: "second" },
    ]);
    expect(scenes.map((scene) => scene.startSec)).toEqual([0, 5]);
    expect(scenes[1].durationSec).toBe(7);
  });

  it("rejects empty or invalid storyboards", () => {
    expect(() => planScenes([])).toThrow(/no scenes/i);
    expect(() => planScenes([{ durationSec: 0 }])).toThrow(/invalid duration/i);
  });

  it("wraps scene text", () => {
    const [scene] = planScenes([
      {
        durationSec: 4,
        onScreenText: "This is a fairly long on screen caption that should wrap",
        narration: "n",
      },
    ]);
    expect(scene.onScreenText).toContain("\n");
  });
});

describe("sceneInputArgs", () => {
  it("creates a colour source when no asset is mapped", () => {
    const args = sceneInputArgs({ source: null, durationSec: 6, hasAudio: false });
    expect(args.join(" ")).toContain("color=c=0x0F172A");
    expect(args.join(" ")).toContain("anullsrc");
  });

  it("loops images for the scene duration", () => {
    const args = sceneInputArgs({
      source: { kind: "image", path: "shot.png" },
      durationSec: 4,
      hasAudio: true,
    });
    expect(args).toContain("-loop");
    expect(args).not.toContain("anullsrc");
  });

  it("loops video when it is shorter than the scene", () => {
    const args = sceneInputArgs({
      source: { kind: "video", path: "clip.mp4" },
      durationSec: 8,
      hasAudio: false,
    });
    expect(args).toContain("-stream_loop");
  });
});

describe("sceneFilterArgs", () => {
  it("always scales and pads to vertical 1080x1920", () => {
    const args = sceneFilterArgs({ textFile: null, narrationFile: null, fontFile: "C:/font.ttf" });
    const filter = args[1];
    expect(filter).toContain("scale=1080:1920");
    expect(filter).toContain("pad=1080:1920");
    expect(filter).toContain("setsar=1");
  });

  it("adds drawtext for on-screen text and narration", () => {
    const args = sceneFilterArgs({
      textFile: "a.txt",
      narrationFile: "b.txt",
      fontFile: "C:/font.ttf",
    });
    expect(args[1].match(/drawtext/g)).toHaveLength(2);
    expect(args[1]).toContain("textfile='a.txt'");
  });
});

describe("parseWhisperJson", () => {
  it("normalizes faster-whisper segments", () => {
    const segments = parseWhisperJson({
      segments: [
        { start: 0.5, end: 1.5, text: " hello " },
        { start: 1.5, end: 2, text: "" },
      ],
    });
    expect(segments).toEqual([{ startSec: 0.5, endSec: 1.5, text: "hello" }]);
  });

  it("rejects output without segments", () => {
    expect(() => parseWhisperJson({ text: "hi" })).toThrow(/no segments/i);
  });
});
