export type SceneInput = {
  narration: string;
  onScreenText: string;
  visualDirection: string;
  sourceAssetId?: string | null;
  editingNotes?: string;
  transition?: string;
  durationSec?: number;
};

export type NormalizedScene = {
  index: number;
  startSec: number;
  durationSec: number;
  narration: string;
  onScreenText: string;
  visualDirection: string;
  sourceAssetId: string | null;
  editingNotes: string;
  transition: string;
};

export type NormalizedStoryboard = {
  scenes: NormalizedScene[];
  totalDurationSec: number;
};

export const MIN_SCENE_SECONDS = 2;
export const MAX_SCENE_SECONDS = 15;
export const DEFAULT_SCENE_SECONDS = 5;

export function normalizeStoryboard(
  scenes: SceneInput[],
  targetDurationSec: number,
): NormalizedStoryboard {
  if (scenes.length === 0) {
    return { scenes: [], totalDurationSec: 0 };
  }
  const minimumTotal = scenes.length * MIN_SCENE_SECONDS;
  const maximumTotal = scenes.length * MAX_SCENE_SECONDS;
  const requested = Math.max(minimumTotal, Math.round(targetDurationSec));
  const target = Math.min(requested, maximumTotal);

  const weights = scenes.map((scene) => {
    const value = scene.durationSec ?? DEFAULT_SCENE_SECONDS;
    return Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, Math.round(value)));
  });
  const order = scenes
    .map((_, index) => index)
    .sort((a, b) => weights[b] - weights[a] || a - b);

  const durations = scenes.map(() => MIN_SCENE_SECONDS);
  let remaining = target - minimumTotal;
  while (remaining > 0) {
    let progressed = false;
    for (const index of order) {
      if (remaining === 0) break;
      if (durations[index] < MAX_SCENE_SECONDS) {
        durations[index] += 1;
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  let start = 0;
  const normalized = scenes.map((scene, index) => {
    const durationSec = durations[index];
    const item: NormalizedScene = {
      index,
      startSec: start,
      durationSec,
      narration: scene.narration.trim(),
      onScreenText: scene.onScreenText.trim(),
      visualDirection: scene.visualDirection.trim(),
      sourceAssetId: scene.sourceAssetId ?? null,
      editingNotes: (scene.editingNotes ?? "").trim(),
      transition: (scene.transition ?? "cut").trim(),
    };
    start += durationSec;
    return item;
  });

  return { scenes: normalized, totalDurationSec: start };
}

export function storyboardIssues(storyboard: {
  targetDurationSec: number;
  totalDurationSec: number;
  scenes: { narration: string; onScreenText: string; durationSec: number }[];
}): string[] {
  const issues: string[] = [];
  if (storyboard.scenes.length < 2) issues.push("A storyboard needs at least two scenes.");
  if (storyboard.scenes.length > 12) issues.push("Keep short-form storyboards to 12 scenes or fewer.");
  if (storyboard.totalDurationSec !== storyboard.targetDurationSec) {
    issues.push(
      `Scene durations total ${storyboard.totalDurationSec}s but the target is ${storyboard.targetDurationSec}s.`,
    );
  }
  if (storyboard.targetDurationSec < 15 || storyboard.targetDurationSec > 180) {
    issues.push("Target duration should be between 15 and 180 seconds.");
  }
  storyboard.scenes.forEach((scene, index) => {
    if (!scene.narration) issues.push(`Scene ${index + 1} has no narration.`);
    if (!scene.onScreenText) issues.push(`Scene ${index + 1} has no on-screen text.`);
  });
  return issues;
}
