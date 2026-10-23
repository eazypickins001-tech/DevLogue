import { z } from "zod";
import { CONTENT_FORMAT_VALUES } from "@/lib/domain/content";

export const PROJECT_STAGES = [
  "idea",
  "validating",
  "building",
  "beta",
  "launched",
] as const;

export const PLATFORMS = [
  "instagram",
  "youtube",
  "linkedin",
  "x",
  "tiktok",
  "facebook",
  "threads",
  "bluesky",
  "other",
] as const;

export const EVIDENCE_KINDS = [
  "commit",
  "pull_request",
  "release",
  "issue",
  "screenshot",
  "recording",
  "note",
  "transcript",
  "link",
  "other",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).default("");

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .default("")
  .refine((value) => value === "" || /^https?:\/\/[^\s]+$/i.test(value), {
    message: "Must start with http:// or https://",
  });

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Project name needs at least 2 characters.").max(120),
  description: optionalText(2000),
  problem: optionalText(4000),
  targetUsers: optionalText(2000),
  stage: z.enum(PROJECT_STAGES),
  repoUrl: optionalUrl,
  workingDir: optionalText(500),
  goals: optionalText(4000),
  positioning: optionalText(2000),
  tone: optionalText(500),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  launchStatus: optionalText(200),
  landingPageUrl: optionalUrl,
  waitlistUrl: optionalUrl,
  feedbackUrl: optionalUrl,
  sensitiveNotes: optionalText(4000),
  publicationExclusions: optionalText(4000),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const sessionInputSchema = z.object({
  projectId: z.uuid("Choose a project."),
  title: z.string().trim().min(3, "Give the session a short title.").max(160),
  workedOn: z.string().trim().min(3, "Describe what you worked on.").max(4000),
  problem: optionalText(4000),
  whyItMatters: optionalText(2000),
  changes: optionalText(6000),
  learned: optionalText(4000),
  worked: optionalText(4000),
  failed: optionalText(4000),
  unfinished: optionalText(4000),
  nextTask: optionalText(1000),
  publishable: z.boolean().default(false),
});

export type SessionInput = z.infer<typeof sessionInputSchema>;

export const evidenceInputSchema = z
  .object({
    sessionId: z.uuid(),
    kind: z.enum(EVIDENCE_KINDS),
    title: z.string().trim().min(2, "Add a short evidence title.").max(200),
    url: optionalUrl,
    externalRef: optionalText(300),
    body: optionalText(8000),
    occurredAt: z.string().trim().max(40).optional().default(""),
    verified: z.boolean().default(false),
  })
  .refine(
    (value) =>
      !["commit", "pull_request", "release", "issue", "link"].includes(value.kind) ||
      value.url.length > 0 ||
      value.externalRef.length > 0,
    { message: "Commits, pull requests, releases, issues and links need a URL or reference." },
  );

export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

export const feedbackInputSchema = z.object({
  projectId: z.uuid(),
  kind: z.enum([
    "feature_request",
    "bug_report",
    "question",
    "potential_customer",
    "early_tester",
    "general",
    "other",
  ]),
  source: z.string().trim().min(1).max(120).default("manual"),
  contact: optionalText(200),
  body: z.string().trim().min(3, "Add the feedback text.").max(4000),
});

export const draftEditSchema = z.object({
  draftId: z.uuid(),
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().min(1, "Draft body cannot be empty.").max(20000),
});

export const generateRequestSchema = z.object({
  sessionId: z.uuid(),
  formats: z.array(z.enum(CONTENT_FORMAT_VALUES)).min(1, "Choose at least one format.").max(3, "Generate at most 3 formats per batch."),
  targetDurationSec: z.coerce.number().int().min(15).max(180).default(45),
});

export function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function formBool(form: FormData, name: string): boolean {
  const value = form.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(" · ");
}

