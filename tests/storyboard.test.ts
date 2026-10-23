import { describe, expect, it } from "vitest";
import {
  MIN_SCENE_SECONDS,
  normalizeStoryboard,
  storyboardIssues,
  type SceneInput,
} from "@/lib/domain/storyboard";

function scenes(count: number, durationSec?: number): SceneInput[] {
  return Array.from({ length: count }, (_, index) => ({
    narration: `Narration ${index}`,
    onScreenText: `Text ${index}`,
    visualDirection: `Show step ${index}`,
    durationSec,
  }));
}

describe("normalizeStoryboard", () => {
  it("returns an empty storyboard for no scenes", () => {
    expect(normalizeStoryboard([], 45)).toEqual({ scenes: [], totalDurationSec: 0 });
  });

  it("scales durations so they sum exactly to the target", () => {
    const result = normalizeStoryboard(scenes(4, 5), 45);
    expect(result.totalDurationSec).toBe(45);
    expect(result.scenes.reduce((sum, scene) => sum + scene.durationSec, 0)).toBe(45);
  });

  it("caps the total when the scene count cannot reach the target", () => {
    const result = normalizeStoryboard(scenes(2, 10), 45);
    expect(result.totalDurationSec).toBe(2 * 15);
    expect(result.scenes.every((scene) => scene.durationSec <= 15)).toBe(true);
  });

  it("keeps start times contiguous", () => {
    const result = normalizeStoryboard(scenes(4, 5), 60);
    let cursor = 0;
    for (const scene of result.scenes) {
      expect(scene.startSec).toBe(cursor);
      cursor += scene.durationSec;
    }
    expect(cursor).toBe(60);
  });

  it("enforces the minimum scene duration", () => {
    const result = normalizeStoryboard(scenes(3, 1), 30);
    for (const scene of result.scenes) {
      expect(scene.durationSec).toBeGreaterThanOrEqual(MIN_SCENE_SECONDS);
    }
    expect(result.totalDurationSec).toBe(30);
  });

  it("raises the target when scenes cannot fit in the requested time", () => {
    const result = normalizeStoryboard(scenes(10, 12), 30);
    expect(result.totalDurationSec).toBeGreaterThanOrEqual(10 * MIN_SCENE_SECONDS);
    expect(result.totalDurationSec).toBe(result.scenes.reduce((sum, s) => sum + s.durationSec, 0));
  });

  it("assigns indexes and trims text", () => {
    const result = normalizeStoryboard(
      [{ narration: "  hi  ", onScreenText: " x ", visualDirection: " y " }],
      15,
    );
    expect(result.scenes[0].index).toBe(0);
    expect(result.scenes[0].narration).toBe("hi");
    expect(result.scenes[0].onScreenText).toBe("x");
  });
});

describe("storyboardIssues", () => {
  const base = {
    targetDurationSec: 45,
    totalDurationSec: 45,
    scenes: [
      { narration: "a", onScreenText: "a", durationSec: 20 },
      { narration: "b", onScreenText: "b", durationSec: 25 },
    ],
  };

  it("accepts a consistent storyboard", () => {
    expect(storyboardIssues(base)).toEqual([]);
  });

  it("flags a duration mismatch", () => {
    const issues = storyboardIssues({ ...base, totalDurationSec: 30 });
    expect(issues.join(" ")).toMatch(/total 30s/);
  });

  it("flags too few scenes and missing text", () => {
    const issues = storyboardIssues({
      targetDurationSec: 45,
      totalDurationSec: 5,
      scenes: [{ narration: "", onScreenText: "", durationSec: 5 }],
    });
    expect(issues).toContain("A storyboard needs at least two scenes.");
    expect(issues.some((issue) => issue.includes("no narration"))).toBe(true);
    expect(issues.some((issue) => issue.includes("no on-screen text"))).toBe(true);
  });

  it("flags out-of-range targets", () => {
    expect(storyboardIssues({ ...base, targetDurationSec: 10 }).join(" ")).toMatch(
      /between 15 and 180/,
    );
  });
});
