import "server-only";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, getDb } from "@/db";
import { errorEvents, errorIncidentNotes, errorIncidents } from "@/db/schema";
import { fingerprintError } from "./fingerprint";
import { redactText, sanitizeBreadcrumbs, sanitizeContext } from "./redact";

export type ErrorSource = "server" | "client" | "worker" | "smoke" | "manual";
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export type CaptureErrorInput = {
  source: ErrorSource;
  severity?: ErrorSeverity;
  error?: unknown;
  name?: string | null;
  message?: string;
  stack?: string | null;
  cause?: string | null;
  title?: string;
  route?: string | null;
  action?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  jobType?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
  timelineId?: string | null;
  mediaId?: string | null;
  context?: Record<string, unknown> | null;
  breadcrumbs?: Record<string, unknown>[] | null;
  userAgent?: string | null;
  fingerprint?: string;
};

const REOPEN_STATUSES = new Set(["fixed", "verified", "archived", "wont_fix"]);
const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

function release(): string | null {
  return (
    process.env.APP_RELEASE?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    null
  );
}

function environment(): string {
  return process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "development";
}

function errorDetails(error: unknown): {
  name: string | null;
  message: string;
  stack: string | null;
  cause: string | null;
} {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : null;
    return {
      name: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack ?? null,
      cause,
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error, stack: null, cause: null };
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message : JSON.stringify(error).slice(0, 2000);
    return {
      name: typeof record.name === "string" ? record.name : "Error",
      message,
      stack: typeof record.stack === "string" ? record.stack : null,
      cause: typeof record.cause === "string" ? record.cause : null,
    };
  }
  return { name: "Error", message: "Unknown error", stack: null, cause: null };
}

function incidentTitle(name: string | null, message: string): string {
  const short = redactText(message, 180).replace(/\s+/g, " ").trim();
  return `${name && name !== "Error" ? `${name}: ` : ""}${short || "Unknown error"}`.slice(0, 240);
}

export async function captureError(input: CaptureErrorInput): Promise<string | null> {
  try {
    if (!isDatabaseConfigured()) return null;

    const details = errorDetails(input.error);
    const message = redactText(input.message ?? details.message, 4000);
    const name = redactText(input.name ?? details.name ?? "Error", 160);
    const stack = input.stack ?? details.stack;
    const cause = redactText(input.cause ?? details.cause ?? "", 2000) || null;
    const route = input.route ? redactText(input.route, 600) : null;
    const action = input.action ? redactText(input.action, 300) : null;
    const severity = input.severity ?? "error";
    const fingerprint =
      input.fingerprint ??
      fingerprintError({
        source: input.source,
        name,
        message,
        stack,
        route,
        action,
      });
    const context = sanitizeContext(input.context ?? {}) as Record<string, unknown>;
    const breadcrumbs = sanitizeBreadcrumbs(input.breadcrumbs);
    const title = redactText(input.title ?? incidentTitle(name, message), 240);
    const now = new Date();
    const db = getDb();

    let incident = (
      await db.select().from(errorIncidents).where(eq(errorIncidents.fingerprint, fingerprint)).limit(1)
    )[0];
    let created = false;

    if (!incident) {
      const inserted = await db
        .insert(errorIncidents)
        .values({
          fingerprint,
          title,
          severity,
          source: input.source,
          environment: environment(),
          release: release(),
          route,
          action,
          errorName: name,
          errorMessage: message,
          topFrame: stack ? redactText(stack.split(/\r?\n/).find((line) => /^\s*at\s+/.test(line)) ?? "", 500) : null,
          cause,
          context,
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: errorIncidents.fingerprint })
        .returning();
      created = Boolean(inserted[0]);
      incident = inserted[0] ?? (
        await db.select().from(errorIncidents).where(eq(errorIncidents.fingerprint, fingerprint)).limit(1)
      )[0];
    }

    if (!incident) return null;

    const reopened = REOPEN_STATUSES.has(incident.status);
    const nextSeverity =
      SEVERITY_RANK[severity] > SEVERITY_RANK[incident.severity] ? severity : incident.severity;

    await db
      .update(errorIncidents)
      .set({
        title,
        severity: nextSeverity,
        status: reopened ? "new" : incident.status,
        source: input.source,
        route: route ?? incident.route,
        action: action ?? incident.action,
        errorName: name,
        errorMessage: message,
        topFrame: stack ? redactText(stack.split(/\r?\n/).find((line) => /^\s*at\s+/.test(line)) ?? "", 500) : incident.topFrame,
        cause: cause ?? incident.cause,
        context,
        occurrenceCount: created ? incident.occurrenceCount : incident.occurrenceCount + 1,
        regressionCount: created ? incident.regressionCount : incident.regressionCount + (reopened ? 1 : 0),
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(errorIncidents.id, incident.id));

    await db.insert(errorEvents).values({
      incidentId: incident.id,
      occurredAt: now,
      source: input.source,
      severity,
      environment: environment(),
      release: release(),
      route,
      action,
      requestId: input.requestId ? redactText(input.requestId, 200) : null,
      traceId: input.traceId ? redactText(input.traceId, 200) : null,
      jobType: input.jobType ? redactText(input.jobType, 80) : null,
      jobId: input.jobId ? redactText(input.jobId, 120) : null,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      timelineId: input.timelineId ?? null,
      mediaId: input.mediaId ?? null,
      errorName: name,
      message,
      stack: stack ? redactText(stack, 12000) : null,
      cause,
      context,
      breadcrumbs,
      userAgent: input.userAgent ? redactText(input.userAgent, 500) : null,
      redacted: true,
    });

    if (reopened) {
      await db.insert(errorIncidentNotes).values({
        incidentId: incident.id,
        actor: "system",
        action: "regression",
        note: `Recurred after status was ${incident.status}.`,
      });
    }

    return incident.id;
  } catch (error) {
    console.error("error-capture: failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export function manualFingerprint(): string {
  return `manual:${randomUUID()}`;
}
