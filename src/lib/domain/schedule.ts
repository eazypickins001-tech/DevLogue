export type ScheduledCandidate = {
  accountId: string | null;
  scheduledAt: Date | string | null;
  status: string;
  id?: string;
};

export type ScheduleConflict = {
  id?: string;
  scheduledAt: string;
  reason: string;
};

const INACTIVE_STATUSES = new Set(["failed", "archived", "published"]);

export function findScheduleConflicts(
  existing: ScheduledCandidate[],
  candidate: ScheduledCandidate,
  windowMinutes = 5,
): ScheduleConflict[] {
  if (!candidate.scheduledAt) return [];
  const candidateTime = new Date(candidate.scheduledAt).getTime();
  if (Number.isNaN(candidateTime)) return [];
  const windowMs = windowMinutes * 60 * 1000;

  return existing
    .filter((post) => post.id !== candidate.id)
    .filter((post) => !INACTIVE_STATUSES.has(post.status))
    .filter((post) => (post.accountId ?? null) === (candidate.accountId ?? null))
    .flatMap((post) => {
      if (!post.scheduledAt) return [];
      const time = new Date(post.scheduledAt).getTime();
      if (Number.isNaN(time)) return [];
      const delta = Math.abs(time - candidateTime);
      if (delta >= windowMs) return [];
      return [
        {
          id: post.id,
          scheduledAt: new Date(time).toISOString(),
          reason: `Another post for the same account is scheduled within ${windowMinutes} minutes.`,
        },
      ];
    });
}

export function normalizeTimezone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return trimmed;
  } catch {
    return "UTC";
  }
}
