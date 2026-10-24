import { describe, expect, it } from "vitest";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  isOtpUsable,
  normalizeEmail,
  verifyOtpCode,
} from "@/lib/domain/otp";

const SECRET = "otp-test-secret";

describe("generateOtpCode", () => {
  it("always produces six digits", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode / verifyOtpCode", () => {
  it("verifies the correct code", () => {
    const hash = hashOtpCode("owner@example.com", "123456", SECRET);
    expect(verifyOtpCode("owner@example.com", "123456", hash, SECRET)).toBe(true);
  });

  it("is case-insensitive for the email", () => {
    const hash = hashOtpCode("Owner@Example.com", "123456", SECRET);
    expect(verifyOtpCode("owner@example.com", "123456", hash, SECRET)).toBe(true);
  });

  it("rejects a wrong code or secret", () => {
    const hash = hashOtpCode("owner@example.com", "123456", SECRET);
    expect(verifyOtpCode("owner@example.com", "654321", hash, SECRET)).toBe(false);
    expect(verifyOtpCode("owner@example.com", "123456", hash, "other")).toBe(false);
  });

  it("trims spaces in the submitted code", () => {
    const hash = hashOtpCode("owner@example.com", "123456", SECRET);
    expect(verifyOtpCode("owner@example.com", " 123456 ", hash, SECRET)).toBe(true);
  });
});

describe("isOtpExpired", () => {
  it("treats past timestamps as expired", () => {
    expect(isOtpExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isOtpExpired(new Date(Date.now() + OTP_TTL_MS))).toBe(false);
  });

  it("treats invalid timestamps as expired", () => {
    expect(isOtpExpired("not-a-date")).toBe(true);
  });
});

describe("isOtpUsable", () => {
  const base = {
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
  };

  it("accepts a fresh token", () => {
    expect(isOtpUsable(base)).toBe(true);
  });

  it("rejects used, expired or over-attempted tokens", () => {
    expect(isOtpUsable({ ...base, usedAt: new Date() })).toBe(false);
    expect(isOtpUsable({ ...base, expiresAt: new Date(Date.now() - 1000) })).toBe(false);
    expect(isOtpUsable({ ...base, attempts: OTP_MAX_ATTEMPTS })).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Owner@Example.COM ")).toBe("owner@example.com");
  });
});
