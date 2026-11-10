import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS, createSessionToken, verifySessionToken } from "@/lib/session";

const SECRET = "test-secret-that-is-long-enough-for-hmac";
const USER_ID = "5b0a3f8e-2f1c-4d7a-9f0e-3a6b1c2d4e5f";

describe("session tokens", () => {
  it("round-trips the user id with the same secret", () => {
    const token = createSessionToken(SECRET, USER_ID);
    expect(verifySessionToken(token, SECRET)).toEqual({
      userId: USER_ID,
      expiresAt: expect.any(Number),
    });
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken(SECRET, USER_ID);
    expect(verifySessionToken(token, "another-secret")).toBeNull();
  });

  it("rejects tampered payloads", () => {
    const token = createSessionToken(SECRET, USER_ID);
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        v: 2,
        sub: "00000000-0000-0000-0000-000000000000",
        exp: Date.now() + SESSION_TTL_MS * 10,
        n: "forged",
      }),
    ).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${signature}`, SECRET)).toBeNull();
    expect(verifySessionToken(`${payload}.deadbeef`, SECRET)).toBeNull();
  });

  it("rejects tokens without a subject", () => {
    const payload = Buffer.from(
      JSON.stringify({ v: 2, exp: Date.now() + SESSION_TTL_MS, n: "x" }),
    ).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(verifySessionToken(`${payload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1000;
    const token = createSessionToken(SECRET, USER_ID, issuedAt);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("", SECRET)).toBeNull();
    expect(verifySessionToken("not-a-token", SECRET)).toBeNull();
    expect(verifySessionToken("a.b.c", SECRET)).toBeNull();
  });
});
