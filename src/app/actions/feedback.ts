"use server";

import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { feedback, projects } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { feedbackInputSchema, formatZodError, formString } from "@/lib/validation";

export async function createFeedback(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/feedback", "Database is not configured.");
  const parsed = feedbackInputSchema.safeParse({
    projectId: formString(formData, "projectId"),
    kind: formString(formData, "kind") || "general",
    source: formString(formData, "source") || "manual",
    contact: formString(formData, "contact"),
    body: formString(formData, "body"),
  });
  if (!parsed.success) redirectError("/feedback", formatZodError(parsed.error));
  const owner = await getOwner();
  const db = getDb();
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, owner.id)))
    .limit(1);
  if (owned.length === 0) redirectError("/feedback", "Project not found.");

  await db.insert(feedback).values({
    projectId: parsed.data.projectId,
    kind: parsed.data.kind,
    source: parsed.data.source,
    contact: parsed.data.contact || null,
    body: parsed.data.body,
  });
  redirectSuccess("/feedback", "Feedback recorded.");
}

export async function setFeedbackStatus(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/feedback", "Database is not configured.");
  const feedbackId = formString(formData, "feedbackId");
  const status = formString(formData, "status");
  const allowed = ["new", "reviewed", "actioned", "archived"];
  if (!allowed.includes(status)) redirectError("/feedback", "Unknown status.");
  const owner = await getOwner();
  const db = getDb();
  const owned = await db
    .select({ id: feedback.id })
    .from(feedback)
    .innerJoin(projects, eq(feedback.projectId, projects.id))
    .where(and(eq(feedback.id, feedbackId), eq(projects.userId, owner.id)))
    .limit(1);
  if (owned.length === 0) redirectError("/feedback", "Feedback not found.");
  await db.update(feedback).set({ status }).where(eq(feedback.id, feedbackId));
  redirectSuccess("/feedback", "Feedback updated.");
}
