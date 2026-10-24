import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashOtpCode(email: string, code: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${normalizeEmail(email)}:${code.trim()}`)
    .digest("hex");
}

export function verifyOtpCode(
  email: string,
  code: string,
  expectedHash: string,
  secret: string,
): boolean {
  if (!code || !expectedHash) return false;
  const actual = Buffer.from(hashOtpCode(email, code, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function isOtpExpired(expiresAt: Date | string, now: number = Date.now()): boolean {
  const value = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isNaN(value) || value <= now;
}

export function isOtpUsable(input: {
  usedAt: Date | string | null;
  expiresAt: Date | string;
  attempts: number;
  now?: number;
}): boolean {
  if (input.usedAt) return false;
  if (input.attempts >= OTP_MAX_ATTEMPTS) return false;
  return !isOtpExpired(input.expiresAt, input.now);
}
