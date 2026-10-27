import type { InferSelectModel } from "drizzle-orm";
import type {
  errorEvents,
  errorIncidentNotes,
  errorIncidents,
} from "@/db/schema";

type Incident = InferSelectModel<typeof errorIncidents>;
type Event = InferSelectModel<typeof errorEvents>;
type Note = InferSelectModel<typeof errorIncidentNotes>;

function iso(value: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toISOString();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

export function buildIncidentBrief(
  incident: Incident,
  events: Event[],
  notes: Note[],
): string {
  const latest = events[0] ?? null;
  return `# DevLogue Incident ${incident.id}

## Summary
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Source: ${incident.source}
- Environment: ${incident.environment ?? "unknown"}
- Release: ${incident.release ?? "unknown"}
- Route: ${incident.route ?? "unknown"}
- Action: ${incident.action ?? "unknown"}

## Failure
- Error: ${incident.errorName ?? "Error"}: ${incident.errorMessage}
- Cause: ${incident.cause ?? "not captured"}
- Top frame: ${incident.topFrame ?? "not captured"}
- First seen: ${iso(incident.firstSeenAt)}
- Last seen: ${iso(incident.lastSeenAt)}
- Occurrences: ${incident.occurrenceCount}
- Regressions: ${incident.regressionCount}

## Context
\`\`\`json
${json(incident.context)}
\`\`\`

## Latest event
\`\`\`json
${json(latest ? {
  id: latest.id,
  occurredAt: latest.occurredAt,
  source: latest.source,
  route: latest.route,
  action: latest.action,
  requestId: latest.requestId,
  traceId: latest.traceId,
  jobType: latest.jobType,
  jobId: latest.jobId,
  projectId: latest.projectId,
  sessionId: latest.sessionId,
  timelineId: latest.timelineId,
  mediaId: latest.mediaId,
  userAgent: latest.userAgent,
  breadcrumbs: latest.breadcrumbs,
  context: latest.context,
} : null)}
\`\`\`

## Stack
\`\`\`text
${latest?.stack ?? "No stack captured."}
\`\`\`

## Related records
- Project: ${latest?.projectId ?? "—"}
- Session: ${latest?.sessionId ?? "—"}
- Timeline: ${latest?.timelineId ?? "—"}
- Media: ${latest?.mediaId ?? "—"}
- Job: ${latest?.jobType ?? "—"} / ${latest?.jobId ?? "—"}

## Existing fix notes
- Commit: ${incident.fixCommit ?? "—"}
- Resolution: ${incident.resolutionSummary ?? "—"}
- Verification method: ${incident.verificationMethod ?? "—"}
- Verification notes: ${incident.verificationNotes ?? "—"}
- Fixed at: ${iso(incident.fixedAt)}
- Verified at: ${iso(incident.verifiedAt)}
- Archived at: ${iso(incident.archivedAt)}

## Audit trail
${notes.length === 0 ? "No notes yet." : notes.map((note) => `- ${iso(note.createdAt)} · ${note.actor} · ${note.action}${note.note ? `: ${note.note}` : ""}`).join("\n")}

## Reproduction hint
Use the route/action and related IDs above. For worker failures, inspect the named job and the latest worker log. Do not guess; verify the failing path before editing.

## AI task
Inspect the repository and identify the root cause. Propose a minimal fix, add or update a regression test, run lint/typecheck/tests/build, and record the commit and verification evidence. Do not publish anything or expose secrets.
`;
}
