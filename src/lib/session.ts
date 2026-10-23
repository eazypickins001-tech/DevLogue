import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function verifyPassword(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function createSessionToken(secret: string, now: number = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
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
): boolean {
  if (!token || !secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length) return false;
    if (!timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}
