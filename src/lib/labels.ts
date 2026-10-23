export const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  validating: "Validating",
  building: "Building",
  beta: "Beta",
  launched: "Launched",
  archived: "Archived",
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  captured: "Captured",
  analyzed: "Analyzed",
  drafted: "Drafted",
  archived: "Archived",
};

export const DRAFT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  archived: "Archived",
};

export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  commit: "Commit",
  pull_request: "Pull request",
  release: "Release",
  issue: "Issue",
  screenshot: "Screenshot",
  recording: "Recording",
  note: "Note",
  transcript: "Transcript",
  link: "Link",
  other: "Other",
};

export const FEEDBACK_KIND_LABELS: Record<string, string> = {
  feature_request: "Feature request",
  bug_report: "Bug report",
  question: "Question",
  potential_customer: "Potential customer",
  early_tester: "Early tester",
  general: "General reaction",
  other: "Other",
};

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function truncate(value: string, length = 160): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= length ? clean : `${clean.slice(0, length - 1)}…`;
}
