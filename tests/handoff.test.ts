import { describe, expect, it } from "vitest";
import { createHandoffToken, verifyHandoffToken } from "@/lib/domain/handoff";

const SECRET = "handoff-secret-for-tests";
const MEDIA_ID = "3f1c0f9e-9d1b-4b0e-9a54-1c2d3e4f5a6b";

describe("handoff tokens", () => {
  it("round-trips a valid token", () => {
    const token = createHandoffToken(MEDIA_ID, SECRET, 600);
    expect(verifyHandoffToken(token, SECRET)).toEqual({ mediaId: MEDIA_ID });
  });

  it("rejects a token signed with another secret", () => {
    const token = createHandoffToken(MEDIA_ID, SECRET, 600);
    expect(verifyHandoffToken(token, "other-secret")).toBeNull();
  });

  it("rejects an expired token", () => {
    const issuedAt = Date.now() - 3600_000;
    const token = createHandoffToken(MEDIA_ID, SECRET, 600, issuedAt);
    expect(verifyHandoffToken(token, SECRET)).toBeNull();
  });

  it("rejects tampered payloads", () => {
    const token = createHandoffToken(MEDIA_ID, SECRET, 600);
    const signature = token.split(".")[1];
    const forged = Buffer.from(`${MEDIA_ID}.9999999999`).toString("base64url");
    expect(verifyHandoffToken(`${forged}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects malformed ids and tokens", () => {
    const token = createHandoffToken("not-a-uuid", SECRET, 600);
    expect(verifyHandoffToken(token, SECRET)).toBeNull();
    expect(verifyHandoffToken("", SECRET)).toBeNull();
    expect(verifyHandoffToken("a.b.c", SECRET)).toBeNull();
  });
});
