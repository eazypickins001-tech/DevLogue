import { describe, expect, it } from "vitest";
import {
  evidenceInputSchema,
  generateRequestSchema,
  projectInputSchema,
  sessionInputSchema,
} from "@/lib/validation";

const validProject = {
  name: "Procurement Assistant",
  description: "",
  problem: "",
  targetUsers: "",
  stage: "building" as const,
  repoUrl: "",
  workingDir: "",
  goals: "",
  positioning: "",
  tone: "",
  platforms: ["linkedin"] as const,
  launchStatus: "",
  landingPageUrl: "",
  waitlistUrl: "",
  feedbackUrl: "",
  sensitiveNotes: "",
  publicationExclusions: "",
};

describe("projectInputSchema", () => {
  it("accepts a minimal project", () => {
    expect(projectInputSchema.safeParse(validProject).success).toBe(true);
  });

  it("rejects a too-short name", () => {
    expect(projectInputSchema.safeParse({ ...validProject, name: "a" }).success).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(projectInputSchema.safeParse({ ...validProject, repoUrl: "github.com/x" }).success).toBe(
      false,
    );
  });

  it("accepts https URLs", () => {
    expect(
      projectInputSchema.safeParse({ ...validProject, repoUrl: "https://github.com/x/y" }).success,
    ).toBe(true);
  });
});

describe("sessionInputSchema", () => {
  const valid = {
    projectId: "3f1c0f9e-9d1b-4b0e-9a54-1c2d3e4f5a6b",
    title: "Fix upload CORS",
    workedOn: "R2 uploads were blocked",
    problem: "",
    whyItMatters: "",
    changes: "",
    learned: "",
    worked: "",
    failed: "",
    unfinished: "",
    nextTask: "",
    publishable: false,
  };

  it("accepts a valid session", () => {
    expect(sessionInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-uuid project id", () => {
    expect(sessionInputSchema.safeParse({ ...valid, projectId: "nope" }).success).toBe(false);
  });

  it("rejects a missing title", () => {
    expect(sessionInputSchema.safeParse({ ...valid, title: "x" }).success).toBe(false);
  });
});

describe("evidenceInputSchema", () => {
  const base = {
    sessionId: "3f1c0f9e-9d1b-4b0e-9a54-1c2d3e4f5a6b",
    kind: "note" as const,
    title: "Learning",
    url: "",
    externalRef: "",
    body: "Something learned",
    occurredAt: "",
    verified: true,
  };

  it("accepts a note without a URL", () => {
    expect(evidenceInputSchema.safeParse(base).success).toBe(true);
  });

  it("requires a reference for commits", () => {
    expect(evidenceInputSchema.safeParse({ ...base, kind: "commit" }).success).toBe(false);
  });

  it("accepts a commit with a URL", () => {
    expect(
      evidenceInputSchema.safeParse({
        ...base,
        kind: "commit",
        url: "https://github.com/x/y/commit/abc",
      }).success,
    ).toBe(true);
  });
});

describe("generateRequestSchema", () => {
  const sessionId = "3f1c0f9e-9d1b-4b0e-9a54-1c2d3e4f5a6b";

  it("accepts up to three formats", () => {
    expect(
      generateRequestSchema.safeParse({
        sessionId,
        formats: ["linkedin_post", "x_post", "short_video"],
        targetDurationSec: 45,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty format selection", () => {
    expect(generateRequestSchema.safeParse({ sessionId, formats: [], targetDurationSec: 45 }).success).toBe(
      false,
    );
  });

  it("rejects more than three formats per batch", () => {
    expect(
      generateRequestSchema.safeParse({
        sessionId,
        formats: ["linkedin_post", "x_post", "x_thread", "short_video"],
        targetDurationSec: 45,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown formats", () => {
    expect(
      generateRequestSchema.safeParse({ sessionId, formats: ["myspace_post"], targetDurationSec: 45 })
        .success,
    ).toBe(false);
  });

  it("coerces duration from a form string within range", () => {
    const parsed = generateRequestSchema.safeParse({
      sessionId,
      formats: ["x_post"],
      targetDurationSec: "60",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.targetDurationSec).toBe(60);
  });
});
