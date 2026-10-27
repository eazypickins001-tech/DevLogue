"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { errorIncidentNotes, errorIncidents } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { captureError, manualFingerprint } from "@/lib/errors/capture";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { formString } from "@/lib/validation";

const STATUSES = ["new", "acknowledged", "investigating", "fixed", "verified", "archived", "wont_fix"] as const;
const SEVERITIES = ["info", "warning", "error", "critical"] as const;

export async function createManualIncident(formData: FormData): Promise<void> {
  await requireSession();
  const title = formString(formData, "title");
  const description = formString(formData, "description");
  const severity = formString(formData, "severity");
  const route = formString(formData, "route");
  if (!title || !description) {
    redirectError("/operations/errors/report", "Add a title and description.");
  }
  const incidentId = await captureError({
    source: "manual",
    severity: SEVERITIES.includes(severity as (typeof SEVERITIES)[number])
      ? (severity as (typeof SEVERITIES)[number])
      : "warning",
    title,
    message: description,
    route,
    action: "manual-report",
    fingerprint: manualFingerprint(),
    context: { reportedFrom: route || null },
  });
  if (!incidentId) redirectError("/operations/errors/report", "Could not save the incident.");
  revalidatePath("/operations/errors");
  redirectSuccess(`/operations/errors/${incidentId}`, "Incident recorded.");
}

export async function updateIncident(formData: FormData): Promise<void> {
  await requireSession();
  const id = formString(formData, "incidentId");
  const status = formString(formData, "status");
  const severity = formString(formData, "severity");
  const title = formString(formData, "title");
  const fixCommit = formString(formData, "fixCommit");
  const resolutionSummary = formString(formData, "resolutionSummary");
  const verificationMethod = formString(formData, "verificationMethod");
  const verificationNotes = formString(formData, "verificationNotes");
  const note = formString(formData, "note");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirectError(`/operations/errors/${id}`, "Unknown incident status.");
  }

  const db = getDb();
  const incident = (
    await db.select().from(errorIncidents).where(eq(errorIncidents.id, id)).limit(1)
  )[0];
  if (!incident) redirectError("/operations/errors", "Incident not found.");

  const nextStatus = status as (typeof STATUSES)[number];
  if (nextStatus === "fixed" && !(fixCommit || incident.fixCommit)) {
    redirectError(`/operations/errors/${id}`, "Add a fix commit before marking this fixed.");
  }
  if (
    nextStatus === "verified" &&
    !(verificationMethod || verificationNotes || incident.verificationMethod || incident.verificationNotes)
  ) {
    redirectError(`/operations/errors/${id}`, "Add verification evidence before marking this verified.");
  }
  const now = new Date();
  await db
    .update(errorIncidents)
    .set({
      status: nextStatus,
      severity: SEVERITIES.includes(severity as (typeof SEVERITIES)[number])
        ? (severity as (typeof SEVERITIES)[number])
        : incident.severity,
      title: title || incident.title,
      fixCommit: fixCommit || null,
      resolutionSummary: resolutionSummary || null,
      verificationMethod: verificationMethod || null,
      verificationNotes: verificationNotes || null,
      fixedAt: nextStatus === "fixed" || nextStatus === "verified" ? incident.fixedAt ?? now : incident.fixedAt,
      verifiedAt: nextStatus === "verified" ? incident.verifiedAt ?? now : incident.verifiedAt,
      archivedAt: nextStatus === "archived" ? incident.archivedAt ?? now : incident.archivedAt,
      updatedAt: now,
    })
    .where(eq(errorIncidents.id, id));

  await db.insert(errorIncidentNotes).values({
    incidentId: id,
    actor: "owner",
    action: `status:${nextStatus}`,
    note: note || null,
  });
  revalidatePath("/operations/errors");
  revalidatePath(`/operations/errors/${id}`);
  redirectSuccess(`/operations/errors/${id}`, "Incident updated.");
}
