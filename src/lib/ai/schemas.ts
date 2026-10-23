import { z } from "zod";

export const analysisSchema = z.object({
  problem: z.string().describe("The concrete problem the session addressed."),
  attemptedSolution: z.string().describe("What was attempted, in plain language."),
  actualChanges: z.array(z.string()).describe("Changes supported by the session evidence."),
  evidence: z.array(z.string()).describe("Evidence identifiers or descriptions that back the changes."),
  tests: z.array(z.string()).describe("Tests or checks that were actually run."),
  failures: z.array(z.string()).describe("What failed or remains broken."),
  lessons: z.array(z.string()).describe("Specific lessons learned."),
  status: z.string().describe("Current status of the work: complete, partial, blocked, etc."),
  openQuestions: z.array(z.string()),
  bestDemo: z.string().describe("The most demonstrable moment in the session."),
  audienceBenefit: z.string().describe("Why a builder or founder would care."),
  contentAngles: z.array(z.string()),
  evidenceGaps: z.array(z.string()).describe("Missing information that blocks stronger claims."),
  claims: z
    .array(
      z.object({
        text: z.string(),
        evidenceIds: z.array(z.string()),
        verified: z.boolean(),
      }),
    )
    .describe("Claims made, each tied to evidence identifiers."),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const textContentSchema = z.object({
  title: z.string().optional().default(""),
  body: z.string(),
  hashtags: z.array(z.string()).optional().default([]),
});

export const threadSchema = z.object({
  title: z.string().optional().default(""),
  posts: z.array(z.string()).min(2).max(10),
});

export const outlineSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        beats: z.array(z.string()).min(1),
      }),
    )
    .min(3)
    .max(10),
});

export const changelogSchema = z.object({
  title: z.string(),
  entries: z
    .array(
      z.object({
        type: z.enum(["added", "changed", "fixed", "removed"]),
        text: z.string(),
      }),
    )
    .min(1),
});

export const storyboardSchema = z.object({
  hook: z.string(),
  cta: z.string(),
  scenes: z
    .array(
      z.object({
        narration: z.string(),
        onScreenText: z.string(),
        visualDirection: z.string(),
        durationSec: z.number().min(1).max(20),
        sourceAssetId: z.string().nullable().optional().default(null),
        editingNotes: z.string().optional().default(""),
        transition: z.string().optional().default("cut"),
      }),
    )
    .min(2)
    .max(12),
});

export type StoryboardOutput = z.infer<typeof storyboardSchema>;

export function formatSchemaFor(format: string): z.ZodTypeAny {
  switch (format) {
    case "x_thread":
      return threadSchema;
    case "youtube_outline":
    case "tutorial_script":
    case "case_study":
      return outlineSchema;
    case "changelog":
      return changelogSchema;
    case "short_video":
      return storyboardSchema;
    default:
      return textContentSchema;
  }
}

export function payloadToBody(format: string, payload: Record<string, unknown>): string {
  if (format === "x_thread") {
    const posts = Array.isArray(payload.posts) ? (payload.posts as string[]) : [];
    return posts.map((post, index) => `${index + 1}/${posts.length}\n${post}`).join("\n\n");
  }
  if (format === "youtube_outline" || format === "tutorial_script" || format === "case_study") {
    const title = typeof payload.title === "string" ? payload.title : "";
    const summary = typeof payload.summary === "string" ? payload.summary : "";
    const sections = Array.isArray(payload.sections)
      ? (payload.sections as { heading: string; beats: string[] }[])
      : [];
    const rendered = sections
      .map((section) => `## ${section.heading}\n${section.beats.map((beat) => `- ${beat}`).join("\n")}`)
      .join("\n\n");
    return [title, summary, rendered].filter(Boolean).join("\n\n");
  }
  if (format === "changelog") {
    const title = typeof payload.title === "string" ? payload.title : "";
    const entries = Array.isArray(payload.entries)
      ? (payload.entries as { type: string; text: string }[])
      : [];
    const rendered = entries.map((entry) => `- **${entry.type}**: ${entry.text}`).join("\n");
    return [title, rendered].filter(Boolean).join("\n\n");
  }
  if (format === "short_video") {
    const hook = typeof payload.hook === "string" ? payload.hook : "";
    const cta = typeof payload.cta === "string" ? payload.cta : "";
    const scenes = Array.isArray(payload.scenes)
      ? (payload.scenes as { narration: string; onScreenText: string }[])
      : [];
    const rendered = scenes
      .map((scene, index) => `${index + 1}. ${scene.onScreenText} — ${scene.narration}`)
      .join("\n");
    return `Hook: ${hook}\n\n${rendered}\n\nCTA: ${cta}`;
  }
  const body = payload.body;
  return typeof body === "string" ? body : JSON.stringify(payload, null, 2);
}

export function payloadTitle(format: string, payload: Record<string, unknown>): string | null {
  const title = payload.title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}
