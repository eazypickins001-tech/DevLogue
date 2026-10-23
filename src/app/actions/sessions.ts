"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/db";
import { buildSessions, sessionEvidence } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";
import {
  evidenceInputSchema,
  formatZodError,
  formBool,
  formString,
  sessionInputSchema,
} from "@/lib/validation";

export async function createSession(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions/new", "Database is not configured.");
  const parsed = sessionInputSchema.safeParse({
    projectId: formString(formData, "projectId"),
    title: formString(formData, "title"),
    workedOn: formString(formData, "workedOn"),
    problem: formString(formData, "problem"),
    whyItMatters: formString(formData, "whyItMatters"),
    changes: formString(formData, "changes"),
    learned: formString(formData, "learned"),
    worked: formString(formData, "worked"),
    failed: formString(formData, "failed"),
    unfinished: formString(formData, "unfinished"),
    nextTask: formString(formData, "nextTask"),
    publishable: formBool(formData, "publishable"),
  });
  if (!parsed.success) redirectError("/sessions/new", formatZodError(parsed.error));
  const owner = await getOwner();
  const db = getDb();
  const inserted = await db
    .insert(buildSessions)
    .values({ ...parsed.data, userId: owner.id })
    .returning({ id: buildSessions.id });
  redirectSuccess(
    `/sessions/${inserted[0].id}`,
    "Session captured. Add evidence, then analyze it.",
  );
}

export async function updateSession(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const sessionId = formString(formData, "sessionId");
  const parsed = sessionInputSchema.safeParse({
    projectId: formString(formData, "projectId"),
    title: formString(formData, "title"),
    workedOn: formString(formData, "workedOn"),
    problem: formString(formData, "problem"),
    whyItMatters: formString(formData, "whyItMatters"),
    changes: formString(formData, "changes"),
    learned: formString(formData, "learned"),
    worked: formString(formData, "worked"),
    failed: formString(formData, "failed"),
    unfinished: formString(formData, "unfinished"),
    nextTask: formString(formData, "nextTask"),
    publishable: formBool(formData, "publishable"),
  });
  if (!parsed.success) redirectError(`/sessions/${sessionId}`, formatZodError(parsed.error));
  const owner = await getOwner();
  const db = getDb();
  const updated = await db
    .update(buildSessions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, owner.id)))
    .returning({ id: buildSessions.id });
  if (updated.length === 0) redirectError("/sessions", "Session not found.");
  redirectSuccess(`/sessions/${sessionId}`, "Session saved.");
}

export async function addEvidence(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const sessionId = formString(formData, "sessionId");
  const parsed = evidenceInputSchema.safeParse({
    sessionId,
    kind: formString(formData, "kind") || "note",
    title: formString(formData, "title"),
    url: formString(formData, "url"),
    externalRef: formString(formData, "externalRef"),
    body: formString(formData, "body"),
    occurredAt: formString(formData, "occurredAt"),
    verified: formBool(formData, "verified"),
  });
  if (!parsed.success) redirectError(`/sessions/${sessionId}`, formatZodError(parsed.error));

  const owner = await getOwner();
  const db = getDb();
  const owned = await db
    .select({ id: buildSessions.id })
    .from(buildSessions)
    .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, owner.id)))
    .limit(1);
  if (owned.length === 0) redirectError("/sessions", "Session not found.");

  await db.insert(sessionEvidence).values({
    sessionId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    url: parsed.data.url || null,
    externalRef: parsed.data.externalRef || null,
    body: parsed.data.body || null,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
    verified: parsed.data.verified,
  });
  redirectSuccess(`/sessions/${sessionId}#evidence`, "Evidence added.");
}

export async function deleteEvidence(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const evidenceId = formString(formData, "evidenceId");
  const sessionId = formString(formData, "sessionId");
  const owner = await getOwner();
  const db = getDb();
  const owned = await db
    .select({ id: buildSessions.id })
    .from(buildSessions)
    .innerJoin(sessionEvidence, eq(sessionEvidence.sessionId, buildSessions.id))
    .where(
      and(
        eq(sessionEvidence.id, evidenceId),
        eq(buildSessions.userId, owner.id),
        eq(buildSessions.id, sessionId),
      ),
    )
    .limit(1);
  if (owned.length === 0) redirectError(`/sessions/${sessionId}`, "Evidence not found.");
  await db.delete(sessionEvidence).where(eq(sessionEvidence.id, evidenceId));
  redirectSuccess(`/sessions/${sessionId}#evidence`, "Evidence removed.");
}

export async function archiveSession(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const sessionId = formString(formData, "sessionId");
  const owner = await getOwner();
  const db = getDb();
  await db
    .update(buildSessions)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, owner.id)));
  redirect("/sessions?message=Session%20archived.");
}
