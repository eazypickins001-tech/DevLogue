"use server";

import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { contentDrafts, projects, renderJobs, storyboards } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/storage";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { formString } from "@/lib/validation";

export async function queueRender(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const draftId = formString(formData, "draftId");
  if (!isStorageConfigured()) {
    redirectError(
      `/studio/${draftId}`,
      "R2 is not configured, so the rendered file cannot be stored.",
    );
  }

  const owner = await getOwner();
  const db = getDb();
  const rows = await db
    .select({ draftId: contentDrafts.id, boardId: storyboards.id })
    .from(contentDrafts)
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .leftJoin(storyboards, eq(storyboards.draftId, contentDrafts.id))
    .where(and(eq(contentDrafts.id, draftId), eq(projects.userId, owner.id)))
    .limit(1);
  const row = rows[0];
  if (!row) redirectError("/studio", "Draft not found.");
  if (!row.boardId) {
    redirectError(`/studio/${draftId}`, "Generate a short-video storyboard before rendering.");
  }

  const active = await db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(and(eq(renderJobs.draftId, draftId), eq(renderJobs.status, "queued")))
    .limit(1);
  const running = await db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(and(eq(renderJobs.draftId, draftId), eq(renderJobs.status, "running")))
    .limit(1);
  if (active.length > 0 || running.length > 0) {
    redirectError(`/studio/${draftId}`, "A render is already queued or running for this draft.");
  }

  await db.insert(renderJobs).values({ draftId, status: "queued" });
  redirectSuccess(
    `/studio/${draftId}#render`,
    "Render queued. Start the worker on your machine with: pnpm worker",
  );
}
