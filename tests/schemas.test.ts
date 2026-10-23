import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  analysisSchema,
  changelogSchema,
  formatSchemaFor,
  payloadToBody,
  storyboardSchema,
  textContentSchema,
  threadSchema,
} from "@/lib/ai/schemas";
import { schemaDescription } from "@/lib/ai/prompts";

const analysis = {
  problem: "Uploads failed",
  attemptedSolution: "Checked CORS",
  actualChanges: ["Added PUT to CORS"],
  evidence: ["commit abc"],
  tests: ["manual upload"],
  failures: [],
  lessons: ["CORS must include content-type"],
  status: "fixed",
  openQuestions: [],
  bestDemo: "Successful upload",
  audienceBenefit: "Avoid a common R2 gotcha",
  contentAngles: ["CORS debugging"],
  evidenceGaps: [],
  claims: [{ text: "Uploads work", evidenceIds: ["abc"], verified: true }],
};

describe("analysisSchema", () => {
  it("accepts a structured analysis", () => {
    expect(analysisSchema.safeParse(analysis).success).toBe(true);
  });

  it("rejects a missing required section", () => {
    const { problem: _problem, ...rest } = analysis;
    expect(analysisSchema.safeParse(rest).success).toBe(false);
  });
});

describe("format schemas", () => {
  it("maps formats to the right schema", () => {
    expect(formatSchemaFor("x_thread")).toBe(threadSchema);
    expect(formatSchemaFor("changelog")).toBe(changelogSchema);
    expect(formatSchemaFor("short_video")).toBe(storyboardSchema);
    expect(formatSchemaFor("linkedin_post")).toBe(textContentSchema);
  });

  it("requires at least two thread posts", () => {
    expect(threadSchema.safeParse({ posts: ["one"] }).success).toBe(false);
    expect(threadSchema.safeParse({ posts: ["one", "two"] }).success).toBe(true);
  });

  it("requires a storyboard scene with timing", () => {
    expect(
      storyboardSchema.safeParse({
        hook: "Hook",
        cta: "Follow",
        scenes: [{ narration: "n", onScreenText: "t", visualDirection: "v", durationSec: 5 }],
      }).success,
    ).toBe(false);
  });
});

describe("payloadToBody", () => {
  it("numbers thread posts", () => {
    const body = payloadToBody("x_thread", { posts: ["first", "second"] });
    expect(body).toContain("1/2");
    expect(body).toContain("2/2");
  });

  it("renders an outline with headings and beats", () => {
    const body = payloadToBody("youtube_outline", {
      title: "Title",
      summary: "Summary",
      sections: [{ heading: "Setup", beats: ["Install", "Configure"] }],
    });
    expect(body).toContain("## Setup");
    expect(body).toContain("- Install");
  });

  it("renders changelog entries", () => {
    const body = payloadToBody("changelog", {
      title: "v1",
      entries: [{ type: "fixed", text: "Upload bug" }],
    });
    expect(body).toContain("**fixed**");
  });

  it("renders a storyboard hook, scenes and CTA", () => {
    const body = payloadToBody("short_video", {
      hook: "Hook",
      cta: "CTA",
      scenes: [{ narration: "Narration", onScreenText: "Text" }],
    });
    expect(body).toContain("Hook:");
    expect(body).toContain("CTA:");
    expect(body).toContain("Text — Narration");
  });
});

describe("schemaDescription", () => {
  it("converts a zod schema to JSON schema", () => {
    const converted = schemaDescription(
      z.object({ body: z.string(), count: z.number().optional() }),
    ) as { type?: string; properties?: Record<string, unknown> };
    expect(converted.type).toBe("object");
    expect(converted.properties?.body).toBeDefined();
  });

  it("never throws for the analysis schema", () => {
    expect(() => schemaDescription(analysisSchema)).not.toThrow();
  });
});
