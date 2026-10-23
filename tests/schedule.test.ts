import { describe, expect, it } from "vitest";
import { findScheduleConflicts, normalizeTimezone } from "@/lib/domain/schedule";

const base = new Date("2026-10-23T10:00:00.000Z");

describe("findScheduleConflicts", () => {
  it("detects a duplicate within the window for the same account", () => {
    const conflicts = findScheduleConflicts(
      [{ id: "a", accountId: "acc1", scheduledAt: base.toISOString(), status: "scheduled" }],
      { id: "b", accountId: "acc1", scheduledAt: new Date(base.getTime() + 60_000), status: "scheduled" },
    );
    expect(conflicts).toHaveLength(1);
  });

  it("ignores other accounts", () => {
    const conflicts = findScheduleConflicts(
      [{ id: "a", accountId: "acc1", scheduledAt: base.toISOString(), status: "scheduled" }],
      { id: "b", accountId: "acc2", scheduledAt: base.toISOString(), status: "scheduled" },
    );
    expect(conflicts).toHaveLength(0);
  });

  it("ignores failed, archived and published posts", () => {
    const conflicts = findScheduleConflicts(
      [
        { id: "a", accountId: "acc1", scheduledAt: base.toISOString(), status: "failed" },
        { id: "b", accountId: "acc1", scheduledAt: base.toISOString(), status: "archived" },
        { id: "c", accountId: "acc1", scheduledAt: base.toISOString(), status: "published" },
      ],
      { id: "d", accountId: "acc1", scheduledAt: base.toISOString(), status: "scheduled" },
    );
    expect(conflicts).toHaveLength(0);
  });

  it("ignores the post itself when updating", () => {
    const conflicts = findScheduleConflicts(
      [{ id: "same", accountId: "acc1", scheduledAt: base.toISOString(), status: "scheduled" }],
      { id: "same", accountId: "acc1", scheduledAt: base.toISOString(), status: "scheduled" },
    );
    expect(conflicts).toHaveLength(0);
  });

  it("allows times outside the window", () => {
    const conflicts = findScheduleConflicts(
      [{ id: "a", accountId: "acc1", scheduledAt: base.toISOString(), status: "scheduled" }],
      { id: "b", accountId: "acc1", scheduledAt: new Date(base.getTime() + 6 * 60_000), status: "scheduled" },
    );
    expect(conflicts).toHaveLength(0);
  });

  it("returns nothing when the candidate has no time", () => {
    expect(
      findScheduleConflicts([], { accountId: "acc1", scheduledAt: null, status: "draft" }),
    ).toEqual([]);
  });
});

describe("normalizeTimezone", () => {
  it("keeps valid IANA timezones", () => {
    expect(normalizeTimezone("Africa/Kigali")).toBe("Africa/Kigali");
  });

  it("falls back to UTC for invalid or empty values", () => {
    expect(normalizeTimezone("")).toBe("UTC");
    expect(normalizeTimezone("Mars/Olympus")).toBe("UTC");
  });
});
