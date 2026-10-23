import { createHmac, timingSafeEqual } from "node:crypto";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createHandoffToken(
  mediaId: string,
  secret: string,
  expiresInSeconds = 1800,
  now: number = Date.now(),
): string {
  const exp = Math.floor(now / 1000) + expiresInSeconds;
  const payload = `${mediaId}.${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload, secret)}`;
}

export function verifyHandoffToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): { mediaId: string } | null {
  if (!token || !secret) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = Buffer.from(sign(payload, secret), "base64url");
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const [mediaId, exp] = payload.split(".");
  if (!mediaId || !exp) return null;
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return null;
  if (Number(exp) * 1000 <= now) return null;
  return { mediaId };
}
