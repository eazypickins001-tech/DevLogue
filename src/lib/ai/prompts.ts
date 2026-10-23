import { z } from "zod";
import { analysisSchema } from "@/lib/ai/schemas";
import { CONTENT_FORMATS, type ContentFormatValue } from "@/lib/domain/content";
import { redactSecrets } from "@/lib/domain/secrets";
import type { StoryboardScenePayload } from "@/db/schema";

export const PROMPT_VERSION = "v1";

export type PromptSession = {
  title: string;
  workedOn: string;
  problem: string;
  whyItMatters: string;
  changes: string;
  learned: string;
  worked: string;
  failed: string;
  unfinished: string;
  nextTask: string;
};

export type PromptProject = {
  name: string;
  description: string;
  targetUsers: string;
  positioning: string;
  tone: string;
  stage: string;
};

export type PromptEvidence = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  verified: boolean;
};

const BASE_SYSTEM = [
  "You are a precise technical editor helping a solo software builder document real work in public.",
  "Use only the facts supplied in the user message.",
  "Never invent features, customers, testimonials, benchmarks, metrics, dates, or outcomes.",
  "Distinguish completed work, work in progress, proposals, and unverified claims.",
  "If a fact is missing, add it to evidence gaps rather than guessing.",
  "Never include API keys, passwords, tokens, connection strings, or private customer data.",
  "Prefer concrete nouns and verbs over marketing adjectives.",
  "Return only JSON. No markdown fences, no commentary.",
].join(" ");

function json(value: unknown): string {
  return redactSecrets(JSON.stringify(value, null, 2));
}

export function buildAnalysisPrompt(input: {
  project: PromptProject;
  session: PromptSession;
  evidence: PromptEvidence[];
  knownAssets: { id: string; kind: string; filename: string; notes: string }[];
}): { system: string; user: string } {
  const user = [
    "Produce a structured analysis of this development session for later content generation.",
    "Every claim must reference evidence ids when evidence exists. Mark verified=false when the evidence does not prove the claim.",
    "List anything that would be needed to support a stronger claim under evidenceGaps.",
    "",
    "OUTPUT JSON SCHEMA (return exactly this shape, all keys present):",
    json(schemaDescription(analysisSchema)),
    "",
    "PROJECT:",
    json(input.project),
    "",
    "SESSION:",
    json(input.session),
    "",
    "EVIDENCE:",
    json(input.evidence),
    "",
    "MEDIA ASSETS (reference ids in bestDemo when relevant):",
    json(input.knownAssets),
  ].join("\n");
  return { system: BASE_SYSTEM, user };
}

const FORMAT_RULES: Record<ContentFormatValue, string[]> = {
  instagram_caption: [
    "Write a caption of 80-200 words for Instagram.",
    "Open with the concrete problem, not a greeting.",
    "End with one specific question or a single call to action.",
    "Hashtags must be topical and limited to 5.",
  ],
  linkedin_post: [
    "Write a LinkedIn post of 120-250 words.",
    "Start with a specific observation from the work.",
    "Use short paragraphs. No bullet walls.",
    "End with a question or an invitation, not a generic summary.",
  ],
  x_post: [
    "Write one post under 280 characters.",
    "One idea only. No hashtags unless strictly necessary.",
  ],
  x_thread: [
    "Write a thread of 3 to 7 posts.",
    "Each post must be under 280 characters and stand on its own.",
    "First post is the hook with a concrete detail.",
  ],
  youtube_title: [
    "Write a specific title under 100 characters.",
    "No clickbait, no fabricated results, no all-caps.",
  ],
  youtube_description: [
    "Write a description of 120-300 words.",
    "Include what was built, what was verified, and what remains unfinished.",
    "Add chapter-style timestamps only if the evidence includes timestamps.",
  ],
  youtube_outline: [
    "Write an outline with 4-8 sections.",
    "Each section has a heading and 2-4 concrete beats.",
    "Name the demonstration shown in each section where possible.",
  ],
  tutorial_script: [
    "Write a tutorial script outline with 4-8 sections.",
    "Each beat must be an action the viewer can follow.",
    "Call out prerequisites and where the viewer might get stuck.",
  ],
  changelog: [
    "Write a changelog entry with added/changed/fixed/removed items.",
    "Only include changes supported by the session evidence.",
  ],
  lesson_learned: [
    "Write about one specific lesson from a failure or surprise in the session.",
    "Do not generalize into motivational advice.",
  ],
  problem_solution_story: [
    "Tell the story in this order: problem, failed attempt, change, verified result.",
    "Name what is still unresolved.",
  ],
  launch_announcement: [
    "Announce only what is actually shipped and verified.",
    "Avoid urgency tactics and fabricated social proof.",
  ],
  waitlist_invite: [
    "Invite the reader to join the waiting list with a specific reason.",
    "State plainly what exists today versus what is planned.",
  ],
  case_study: [
    "Write a technical case study outline with context, constraints, approach, results, and open questions.",
    "Results must be limited to what the evidence shows.",
  ],
  short_video: [
    "Create a vertical 9:16 short-form storyboard.",
    "Scene durations must add up exactly to the target duration.",
    "Use 4 to 8 scenes. Hook in the first 3 seconds.",
    "onScreenText must be under 60 characters per scene.",
    "Assign sourceAssetId only from the provided media asset ids; otherwise use null.",
    "Visual directions must describe what the editor should show.",
  ],
};

export function buildContentPrompt(input: {
  project: PromptProject;
  session: PromptSession;
  analysis: Record<string, unknown>;
  format: ContentFormatValue;
  targetDurationSec: number;
  evidenceCorpus: string;
  assets: { id: string; kind: string; filename: string; notes: string }[];
  schemaJson: unknown;
  qualityFeedback?: string[];
}): { system: string; user: string } {
  const spec = CONTENT_FORMATS[input.format];
  const user = [
    `Create one ${spec.label} for ${spec.platform}.`,
    "",
    "FORMAT RULES:",
    ...FORMAT_RULES[input.format].map((rule) => `- ${rule}`),
    input.format === "short_video"
      ? `- Target duration: exactly ${input.targetDurationSec} seconds total.`
      : "",
    "",
    "OUTPUT JSON SCHEMA:",
    json(input.schemaJson),
    "",
    "PROJECT:",
    json(input.project),
    "",
    "APPROVED SESSION ANALYSIS:",
    json(input.analysis),
    "",
    "SESSION NOTES:",
    json(input.session),
    "",
    "EVIDENCE CORPUS (only these facts may be cited):",
    json(input.evidenceCorpus),
    "",
    "AVAILABLE MEDIA ASSETS:",
    json(input.assets),
    input.qualityFeedback?.length
      ? `\nFIX THESE ISSUES FROM THE PREVIOUS DRAFT:\n${input.qualityFeedback.map((item) => `- ${item}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { system: BASE_SYSTEM, user };
}

export function schemaDescription(schema: z.ZodTypeAny): unknown {
  try {
    return z.toJSONSchema(schema);
  } catch {
    return {};
  }
}

export function evidenceCorpus(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
}

export const STORYBOARD_SCENE_FIELDS: (keyof StoryboardScenePayload)[] = [
  "index",
  "startSec",
  "durationSec",
  "narration",
  "onScreenText",
  "visualDirection",
  "sourceAssetId",
  "editingNotes",
  "transition",
];
