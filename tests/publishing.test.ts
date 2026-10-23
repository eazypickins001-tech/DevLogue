import { describe, expect, it } from "vitest";
import {
  ghlMediaLimitBytes,
  ghlMediaType,
  postTypeForFormat,
  resolvePostStatus,
  zonedLocalToUtcIso,
} from "@/lib/domain/publishing";

describe("resolvePostStatus", () => {
  it("always drafts in test mode, even with a schedule", () => {
    expect(
      resolvePostStatus({ testMode: true, scheduledAt: new Date("2026-11-01T10:00:00Z") }),
    ).toBe("draft");
  });

  it("schedules a future post outside test mode", () => {
    expect(
      resolvePostStatus({ testMode: false, scheduledAt: new Date("2026-11-01T10:00:00Z") }),
    ).toBe("scheduled");
  });

  it("falls back to draft without a schedule", () => {
    expect(resolvePostStatus({ testMode: false, scheduledAt: null })).toBe("draft");
  });
});

describe("postTypeForFormat", () => {
  it("maps short video to reel", () => {
    expect(postTypeForFormat("short_video")).toBe("reel");
  });

  it("maps text formats to post", () => {
    expect(postTypeForFormat("linkedin_post")).toBe("post");
    expect(postTypeForFormat("instagram_caption")).toBe("post");
    expect(postTypeForFormat("x_thread")).toBe("post");
  });
});

describe("zonedLocalToUtcIso", () => {
  it("converts a Kigali local time (UTC+2) to UTC", () => {
    expect(zonedLocalToUtcIso("2026-11-01T10:30", "Africa/Kigali")).toBe(
      "2026-11-01T08:30:00.000Z",
    );
  });

  it("handles a UTC timezone", () => {
    expect(zonedLocalToUtcIso("2026-01-15T09:00", "UTC")).toBe("2026-01-15T09:00:00.000Z");
  });

  it("rejects malformed input and unknown zones", () => {
    expect(zonedLocalToUtcIso("not-a-date", "UTC")).toBeNull();
    expect(zonedLocalToUtcIso("2026-11-01T10:30", "Mars/Olympus")).toBeNull();
  });
});

describe("GHL media helpers", () => {
  it("maps supported media kinds only", () => {
    expect(ghlMediaType("image")).toBe("image");
    expect(ghlMediaType("video")).toBe("video");
    expect(ghlMediaType("document")).toBeNull();
    expect(ghlMediaType("audio")).toBeNull();
  });

  it("uses provider media limits", () => {
    expect(ghlMediaLimitBytes("video")).toBe(500 * 1024 * 1024);
    expect(ghlMediaLimitBytes("image")).toBe(25 * 1024 * 1024);
  });
});
