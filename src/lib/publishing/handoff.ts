import "server-only";

import {
  createHandoffToken as createToken,
  verifyHandoffToken as verifyToken,
} from "@/lib/domain/handoff";

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is required for media handoff links.");
  return value;
}

export function publicAppUrl(): string | null {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/\/+$/, "")}`;
  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return `https://${preview.replace(/\/+$/, "")}`;
  return null;
}

export function isPublicAppUrl(url: string | null): url is string {
  return Boolean(url && /^https:\/\//i.test(url) && !/localhost|127\.0\.0\.1/i.test(url));
}

export function createHandoffToken(mediaId: string, expiresInSeconds = 1800): string {
  return createToken(mediaId, secret(), expiresInSeconds);
}

export function verifyHandoffToken(token: string): { mediaId: string } | null {
  return verifyToken(token, secret());
}
