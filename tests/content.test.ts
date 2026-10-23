import { describe, expect, it } from "vitest";
import { hasBlockingIssues, lintContent } from "@/lib/domain/content";

describe("lintContent", () => {
  it("passes a specific, evidence-backed caption", () => {
    const issues = lintContent("Fixed the R2 CORS bug by allowing PUT from the app origin.", {
      platform: "linkedin",
      evidenceCorpus: "Fixed R2 CORS bug allowing PUT",
    });
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("blocks text that is too short", () => {
    const issues = lintContent("ok", { minChars: 12 });
    expect(issues[0].code).toBe("too_short");
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("enforces platform character limits", () => {
    const issues = lintContent("a".repeat(281), { platform: "x", minChars: 10 });
    expect(issues.some((issue) => issue.code === "platform_limit")).toBe(true);
  });

  it("warns about generic marketing phrases", () => {
    const issues = lintContent("This game-changer will supercharge your workflow.", { minChars: 10 });
    expect(issues.filter((issue) => issue.code === "banned_phrase").length).toBe(2);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("warns about hype punctuation and emoji overload", () => {
    const issues = lintContent("It works!!! 🚀🚀🚀🚀🚀🚀🚀 really", { minChars: 10 });
    expect(issues.some((issue) => issue.code === "hype_punctuation")).toBe(true);
    expect(issues.some((issue) => issue.code === "emoji_overload")).toBe(true);
  });

  it("flags numbers that are absent from the evidence corpus", () => {
    const issues = lintContent("We cut build time by 40%.", {
      minChars: 10,
      evidenceCorpus: "Build time improved after caching.",
    });
    expect(issues.some((issue) => issue.code === "unsupported_numbers")).toBe(true);
  });

  it("accepts numbers that appear in the evidence corpus", () => {
    const issues = lintContent("We cut build time by 40%.", {
      minChars: 10,
      evidenceCorpus: "Build time dropped from 100s to 60s (40% faster).",
    });
    expect(issues.some((issue) => issue.code === "unsupported_numbers")).toBe(false);
  });

  it("skips number checks when no corpus is supplied", () => {
    const issues = lintContent("We cut build time by 40%.", { minChars: 10 });
    expect(issues.some((issue) => issue.code === "unsupported_numbers")).toBe(false);
  });
});
