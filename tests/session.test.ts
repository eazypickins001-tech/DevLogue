import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from "@/lib/session";

const SECRET = "test-secret-that-is-long-enough-for-hmac";

describe("password verification", () => {
  it("accepts the exact password", () => {
    expect(verifyPassword("correct horse", "correct horse")).toBe(true);
  });

  it("rejects wrong or empty input", () => {
    expect(verifyPassword("wrong", "correct horse")).toBe(false);
    expect(verifyPassword("", "correct horse")).toBe(false);
    expect(verifyPassword("correct horse", "")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a token with the same secret", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, "another-secret")).toBe(false);
  });

  it("rejects tampered payloads", () => {
    const token = createSessionToken(SECRET);
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ v: 1, exp: Date.now() + SESSION_TTL_MS * 10, n: "forged" }),
    ).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${signature}`, SECRET)).toBe(false);
    expect(verifySessionToken(`${payload}.deadbeef`, SECRET)).toBe(false);
  });

  it("rejects expired tokens", () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1000;
    const token = createSessionToken(SECRET, issuedAt);
    expect(verifySessionToken(token, SECRET)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("", SECRET)).toBe(false);
    expect(verifySessionToken("not-a-token", SECRET)).toBe(false);
    expect(verifySessionToken("a.b.c", SECRET)).toBe(false);
  });
});
