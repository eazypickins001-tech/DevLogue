import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

const KEY = "test:rate-limit";

describe("checkRateLimit (memory fallback)", () => {
  beforeEach(() => {
    resetRateLimit(KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimit(KEY);
  });

  it("allows requests up to the limit and blocks the next one", async () => {
    expect(await checkRateLimit(KEY, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(KEY, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(KEY, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(KEY, 3, 60_000)).toBe(false);
  });

  it("resets after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(await checkRateLimit(KEY, 1, 60_000)).toBe(true);
    expect(await checkRateLimit(KEY, 1, 60_000)).toBe(false);
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(await checkRateLimit(KEY, 1, 60_000)).toBe(true);
  });
});
