import type { ContentFormatValue } from "@/lib/domain/content";

export type GhlPostType = "post" | "story" | "reel";
export type GhlPostStatus = "draft" | "scheduled";

export function isTestMode(): boolean {
  return (process.env.GHL_TEST_MODE ?? "true").trim().toLowerCase() !== "false";
}

export function postTypeForFormat(format: ContentFormatValue): GhlPostType {
  return format === "short_video" ? "reel" : "post";
}

export function resolvePostStatus(input: {
  testMode: boolean;
  scheduledAt: Date | null;
}): GhlPostStatus {
  if (input.testMode) return "draft";
  return input.scheduledAt ? "scheduled" : "draft";
}

export function zonedLocalToUtcIso(localDateTime: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localDateTime.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (Number.isNaN(utcGuess)) return null;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUtc - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

export function ghlMediaType(kind: string): "image" | "video" | null {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  return null;
}

export function ghlMediaLimitBytes(kind: "image" | "video"): number {
  return kind === "video" ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
}
