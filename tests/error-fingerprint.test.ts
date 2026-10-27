import { describe, expect, it } from "vitest";
import { fingerprintError, normalizeErrorText, topStackFrames } from "@/lib/errors/fingerprint";

describe("error fingerprinting", () => {
  it("normalizes volatile ids, urls and numbers", () => {
    const a = normalizeErrorText("Timeline 555c9828-3f8b-47b8-b6fe-bc890d47a234 failed at 2026-10-26 with id 123456 https://example.com/a");
    const b = normalizeErrorText("Timeline 11111111-1111-1111-1111-111111111111 failed at 2026-10-27 with id 987654 https://example.com/b");
    expect(a).toBe(b);
  });

  it("keeps the same fingerprint across retries", () => {
    const base = {
      source: "worker",
      name: "Error",
      message: "ffmpeg exited 1 for job 555c9828-3f8b-47b8-b6fe-bc890d47a234",
      stack: "Error: failed\n    at renderTimeline (/app/scripts/render-worker.mjs:420:12)\n    at process (/app/scripts/render-worker.mjs:700:5)",
      route: "/timelines/555c9828-3f8b-47b8-b6fe-bc890d47a234",
    };
    expect(fingerprintError(base)).toBe(
      fingerprintError({ ...base, message: "ffmpeg exited 1 for job 11111111-1111-1111-1111-111111111111" }),
    );
  });

  it("separates different sources and actions", () => {
    const base = { message: "boom", stack: null, route: "/studio", action: "render" };
    expect(fingerprintError({ ...base, source: "server" })).not.toBe(
      fingerprintError({ ...base, source: "client" }),
    );
    expect(fingerprintError({ ...base, source: "server" })).not.toBe(
      fingerprintError({ ...base, source: "server", action: "publish" }),
    );
  });

  it("extracts top frames", () => {
    expect(
      topStackFrames("Error: x\n    at a (/app/a.ts:1:2)\n    at b (/app/b.ts:3:4)", 1),
    ).toEqual(["at a (a.ts)"]);
  });
});
