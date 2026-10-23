export type PlatformValue =
  | "instagram"
  | "youtube"
  | "linkedin"
  | "x"
  | "tiktok"
  | "facebook"
  | "threads"
  | "bluesky"
  | "other";

export const PLATFORM_LABELS: Record<PlatformValue, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  facebook: "Facebook",
  threads: "Threads",
  bluesky: "Bluesky",
  other: "Other",
};

export const PLATFORM_CHAR_LIMITS: Partial<Record<PlatformValue, number>> = {
  instagram: 2200,
  linkedin: 3000,
  x: 280,
  youtube: 5000,
};

export const CONTENT_FORMATS = {
  instagram_caption: {
    label: "Instagram caption",
    platform: "instagram",
    description: "Punchy reel or carousel caption with a concrete takeaway.",
  },
  linkedin_post: {
    label: "LinkedIn post",
    platform: "linkedin",
    description: "Build-in-public update for a professional audience.",
  },
  x_post: {
    label: "X post",
    platform: "x",
    description: "Single post under 280 characters.",
  },
  x_thread: {
    label: "X thread",
    platform: "x",
    description: "Thread of 3-8 posts, each under 280 characters.",
  },
  youtube_title: {
    label: "YouTube title",
    platform: "youtube",
    description: "Specific, curiosity-driven title without clickbait claims.",
  },
  youtube_description: {
    label: "YouTube description",
    platform: "youtube",
    description: "Description with what was built, timestamps, and links.",
  },
  youtube_outline: {
    label: "YouTube outline",
    platform: "youtube",
    description: "Long-form outline with sections and beats.",
  },
  short_video: {
    label: "Short-form video storyboard",
    platform: "instagram",
    description: "30-60 second vertical video storyboard with scenes.",
  },
  tutorial_script: {
    label: "Tutorial script",
    platform: "youtube",
    description: "Step-by-step developer tutorial from the session.",
  },
  changelog: {
    label: "Changelog article",
    platform: "other",
    description: "Product changelog entry grounded in this session.",
  },
  lesson_learned: {
    label: "Lesson learned",
    platform: "linkedin",
    description: "One specific lesson from a failure or surprise.",
  },
  problem_solution_story: {
    label: "Problem and solution story",
    platform: "linkedin",
    description: "Narrative from problem to working change.",
  },
  launch_announcement: {
    label: "Launch announcement",
    platform: "other",
    description: "Announcement that only claims what is verified.",
  },
  waitlist_invite: {
    label: "Waiting-list invitation",
    platform: "other",
    description: "Invite readers to join the waiting list.",
  },
  case_study: {
    label: "Technical case study",
    platform: "other",
    description: "Deeper technical write-up of the problem and work.",
  },
} as const;

export type ContentFormatValue = keyof typeof CONTENT_FORMATS;

export const CONTENT_FORMAT_VALUES = Object.keys(CONTENT_FORMATS) as ContentFormatValue[];

export function isContentFormat(value: string): value is ContentFormatValue {
  return value in CONTENT_FORMATS;
}

export const BANNED_PHRASES = [
  "game-changer",
  "game changer",
  "revolutionary",
  "unlock the power",
  "unleash",
  "seamlessly",
  "seamless",
  "in today's fast-paced world",
  "dive into",
  "take it to the next level",
  "10x your",
  "guaranteed",
  "effortlessly",
  "supercharge",
  "cutting-edge",
] as const;

export type LintIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

export type LintOptions = {
  platform?: PlatformValue;
  evidenceCorpus?: string;
  minChars?: number;
};

function extractNumericTokens(text: string): string[] {
  return Array.from(text.matchAll(/\b\d+(?:[.,]\d+)?\b/g)).map((match) =>
    match[0].replace(",", ""),
  );
}

export function lintContent(text: string, options: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const trimmed = text.trim();
  const minChars = options.minChars ?? 12;

  if (trimmed.length < minChars) {
    issues.push({
      code: "too_short",
      severity: "error",
      message: `Content is only ${trimmed.length} characters; at least ${minChars} are needed.`,
    });
  }

  if (options.platform) {
    const limit = PLATFORM_CHAR_LIMITS[options.platform];
    if (limit && trimmed.length > limit) {
      issues.push({
        code: "platform_limit",
        severity: "error",
        message: `${options.platform} allows ${limit} characters; this is ${trimmed.length}.`,
      });
    }
  }

  const lowered = trimmed.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowered.includes(phrase)) {
      issues.push({
        code: "banned_phrase",
        severity: "warning",
        message: `Generic marketing phrase found: "${phrase}".`,
      });
    }
  }

  const exclamations = (trimmed.match(/!/g) ?? []).length;
  if (exclamations >= 3) {
    issues.push({
      code: "hype_punctuation",
      severity: "warning",
      message: `${exclamations} exclamation marks reads as hype rather than evidence.`,
    });
  }

  if ((trimmed.match(/\p{Extended_Pictographic}/gu) ?? []).length > 6) {
    issues.push({
      code: "emoji_overload",
      severity: "warning",
      message: "Too many emoji; keep the focus on the work.",
    });
  }

  if (options.evidenceCorpus !== undefined) {
    const corpus = options.evidenceCorpus.toLowerCase();
    const unsupported = Array.from(new Set(extractNumericTokens(trimmed))).filter(
      (token) => !corpus.includes(token),
    );
    if (unsupported.length > 0) {
      issues.push({
        code: "unsupported_numbers",
        severity: "warning",
        message: `Numbers not found in the session evidence: ${unsupported.join(", ")}. Verify or remove them.`,
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: LintIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
