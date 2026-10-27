import { createHash } from "node:crypto";

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX_PATTERN = /\b[0-9a-f]{16,}\b/gi;
const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?\b/g;
const LONG_NUMBER_PATTERN = /\b\d{4,}\b/g;
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export type FingerprintInput = {
  source: string;
  name?: string | null;
  message: string;
  stack?: string | null;
  route?: string | null;
  action?: string | null;
};

export function normalizeErrorText(value: string, max = 500): string {
  return value
    .replace(ANSI_PATTERN, "")
    .replace(DATE_PATTERN, "<date>")
    .replace(UUID_PATTERN, "<uuid>")
    .replace(HEX_PATTERN, "<hash>")
    .replace(LONG_NUMBER_PATTERN, "<number>")
    .replace(/https?:\/\/[^\s)]+/gi, "<url>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function topStackFrames(stack: string | null | undefined, limit = 4): string[] {
  if (!stack) return [];
  return stack
    .split(/\r?\n/)
    .filter((line) => /^\s*at\s+/.test(line))
    .slice(0, limit)
    .map((line) =>
      line
        .replace(/:\d+:\d+\b/g, "")
        .replace(/\(.*?[\\/]([^\\/)]+)\)/g, "($1)")
        .replace(/\s+/g, " ")
        .trim(),
    );
}

export function fingerprintError(input: FingerprintInput): string {
  const parts = [
    input.source,
    input.name ?? "Error",
    normalizeErrorText(input.message),
    normalizeErrorText(input.route ?? "", 200),
    normalizeErrorText(input.action ?? "", 200),
    ...topStackFrames(input.stack).map((frame) => normalizeErrorText(frame, 300)),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
