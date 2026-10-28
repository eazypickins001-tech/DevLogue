export type RenderJobRow = {
  id: string;
  groupId: string;
  outputKey: string | null;
  label: string;
  createdAt: Date;
};

export function supersededRenderKeys(jobs: RenderJobRow[], cutoff: Date): Map<string, string> {
  const latest = new Map<string, { id: string; createdAt: Date }>();
  for (const job of jobs) {
    const current = latest.get(job.groupId);
    const newer =
      !current ||
      job.createdAt.getTime() > current.createdAt.getTime() ||
      (job.createdAt.getTime() === current.createdAt.getTime() && job.id > current.id);
    if (newer) latest.set(job.groupId, { id: job.id, createdAt: job.createdAt });
  }
  const keys = new Map<string, string>();
  for (const job of jobs) {
    if (!job.outputKey) continue;
    if (job.createdAt >= cutoff) continue;
    if (latest.get(job.groupId)?.id === job.id) continue;
    keys.set(job.outputKey, job.label);
  }
  return keys;
}
