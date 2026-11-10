import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export type SessionPayload = { userId: string; expiresAt: number };

export function createSessionToken(
  secret: string,
  userId: string,
  now: number = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 2,
      sub: userId,
      exp: now + SESSION_TTL_MS,
      n: randomBytes(12).toString("base64url"),
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length) return null;
    if (!timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      v?: unknown;
      sub?: unknown;
      exp?: unknown;
    };
    if (data.v !== 2 || typeof data.sub !== "string" || !data.sub) return null;
    if (typeof data.exp !== "number" || data.exp <= now) return null;
    return { userId: data.sub, expiresAt: data.exp };
  } catch {
    return null;
  }
}
