"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/db";
import { buildSessions, mediaAssets, multipartUploads, projects } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { slugify } from "@/lib/labels";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { abortMultipartUpload as abortR2Multipart } from "@/lib/storage-multipart";
import {
  PLATFORMS,
  formatZodError,
  formString,
  projectInputSchema,
  type ProjectInput,
} from "@/lib/validation";

type ParsedProject = Omit<ProjectInput, "goals"> & { goals: string[] };

async function parseProjectForm(formData: FormData): Promise<ParsedProject | string> {
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter((value): value is (typeof PLATFORMS)[number] =>
      (PLATFORMS as readonly string[]).includes(value),
    );
  const parsed = projectInputSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    problem: formString(formData, "problem"),
    targetUsers: formString(formData, "targetUsers"),
    stage: formString(formData, "stage") || "building",
    repoUrl: formString(formData, "repoUrl"),
    workingDir: formString(formData, "workingDir"),
    goals: formString(formData, "goals"),
    positioning: formString(formData, "positioning"),
    tone: formString(formData, "tone"),
    platforms,
    launchStatus: formString(formData, "launchStatus"),
    landingPageUrl: formString(formData, "landingPageUrl"),
    waitlistUrl: formString(formData, "waitlistUrl"),
    feedbackUrl: formString(formData, "feedbackUrl"),
    sensitiveNotes: formString(formData, "sensitiveNotes"),
    publicationExclusions: formString(formData, "publicationExclusions"),
  });
  if (!parsed.success) return formatZodError(parsed.error);
  return {
    ...parsed.data,
    goals: parsed.data.goals
      .split("\n")
      .map((goal) => goal.trim())
      .filter(Boolean),
  };
}

async function uniqueSlug(userId: string, name: string): Promise<string> {
  const db = getDb();
  const base = slugify(name) || "project";
  let candidate = base;
  for (let index = 2; index < 100; index += 1) {
    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.slug, candidate)))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${index}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createProject(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/projects/new", "Database is not configured.");
  const parsed = await parseProjectForm(formData);
  if (typeof parsed === "string") redirectError("/projects/new", parsed);
  const owner = await getOwner();
  const db = getDb();
  const slug = await uniqueSlug(owner.id, parsed.name);
  const inserted = await db
    .insert(projects)
    .values({ ...parsed, userId: owner.id, slug })
    .returning({ id: projects.id });
  redirectSuccess(`/projects/${inserted[0].id}`, "Project created.");
}

export async function updateProject(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/projects", "Database is not configured.");
  const projectId = formString(formData, "projectId");
  if (!projectId) redirectError("/projects", "Missing project.");
  const parsed = await parseProjectForm(formData);
  if (typeof parsed === "string") redirectError(`/projects/${projectId}`, parsed);
  const owner = await getOwner();
  const db = getDb();
  const updated = await db
    .update(projects)
    .set({ ...parsed, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, owner.id)))
    .returning({ id: projects.id });
  if (updated.length === 0) redirectError("/projects", "Project not found.");
  redirectSuccess(`/projects/${projectId}`, "Project saved.");
}

export async function toggleProjectArchive(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/projects", "Database is not configured.");
  const projectId = formString(formData, "projectId");
  const archive = formString(formData, "archive") === "true";
  const owner = await getOwner();
  const db = getDb();
  await db
    .update(projects)
    .set({ archivedAt: archive ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, owner.id)));
  redirectSuccess("/projects", archive ? "Project archived." : "Project restored.");
}

export async function deleteProjectData(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/projects", "Database is not configured.");
  const projectId = formString(formData, "projectId");
  const confirmation = formString(formData, "confirmation");
  if (confirmation !== "DELETE") {
    redirectError(`/projects/${projectId}`, "Type DELETE to confirm permanent deletion.");
  }
  const owner = await getOwner();
  const db = getDb();
  const sessionRows = await db
    .select({ id: buildSessions.id })
    .from(buildSessions)
    .where(and(eq(buildSessions.projectId, projectId), eq(buildSessions.userId, owner.id)));
  const sessionIds = sessionRows.map((row) => row.id);

  if (isStorageConfigured()) {
    const [projectAssets, sessionAssets, uploads] = await Promise.all([
      db.select().from(mediaAssets).where(eq(mediaAssets.projectId, projectId)),
      sessionIds.length > 0
        ? db.select().from(mediaAssets).where(inArray(mediaAssets.sessionId, sessionIds))
        : Promise.resolve([]),
      sessionIds.length > 0
        ? db.select().from(multipartUploads).where(inArray(multipartUploads.sessionId, sessionIds))
        : Promise.resolve([]),
    ]);
    const assets = [...new Map([...projectAssets, ...sessionAssets].map((asset) => [asset.id, asset])).values()];
    for (const asset of assets) {
      for (const key of [asset.storageKey, asset.thumbnailKey, asset.waveformKey].filter(
        (value): value is string => Boolean(value),
      )) {
        await deleteObject(key).catch(() => undefined);
      }
    }
    for (const upload of uploads) {
      if (upload.status !== "uploading") continue;
      await abortR2Multipart(upload.key, upload.uploadId).catch(() => undefined);
    }
  }

  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, owner.id)));
  redirect("/projects?message=Project%20and%20all%20related%20storage%20were%20deleted.");
}
