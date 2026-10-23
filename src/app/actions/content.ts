"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  approvals,
  buildSessions,
  contentDrafts,
  draftVersions,
  storyboardScenes,
  storyboards,
  usageRecords,
} from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { isAiConfigured } from "@/lib/env";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { CONTENT_FORMATS, type ContentFormatValue } from "@/lib/domain/content";
import { getDraftDetail, getSessionDetail } from "@/lib/queries";
import { generateDraftForFormat } from "@/lib/services/content";
import type { Analysis } from "@/lib/ai/schemas";
import {
  draftEditSchema,
  formatZodError,
  formString,
  generateRequestSchema,
} from "@/lib/validation";

function analysisFromPayload(value: unknown): Analysis | null {
  if (!value || typeof value !== "object") return null;
  return value as Analysis;
}

export async function generateContent(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const sessionId = formString(formData, "sessionId");
  if (!isAiConfigured()) {
    redirectError(
      `/sessions/${sessionId}`,
      "AI is not configured. Add OPENROUTER_API_KEY and AI_MODEL to .env.local.",
    );
  }
  const parsed = generateRequestSchema.safeParse({
    sessionId,
    formats: formData.getAll("formats").map(String),
    targetDurationSec: formString(formData, "targetDurationSec") || 45,
  });
  if (!parsed.success) redirectError(`/sessions/${sessionId}`, formatZodError(parsed.error));

  const owner = await getOwner();
  const detail = await getSessionDetail(owner.id, sessionId);
  if (!detail) redirectError("/sessions", "Session not found.");

  const succeeded = detail.analyses.find(
    (analysis) => analysis.status === "succeeded" && analysis.summary,
  );
  if (!succeeded) {
    redirectError(
      `/sessions/${sessionId}`,
      "Analyze this session before generating content, so every asset is grounded in evidence.",
    );
  }
  const analysis = analysisFromPayload(succeeded.summary);
  if (!analysis) redirectError(`/sessions/${sessionId}`, "The analysis payload is unreadable.");

  const db = getDb();
  const failures: string[] = [];
  const created: string[] = [];
  let warnings = 0;

  for (const format of parsed.data.formats) {
    try {
      const generated = await generateDraftForFormat({
        detail,
        analysis,
        format,
        targetDurationSec: parsed.data.targetDurationSec,
      });
      warnings += generated.issues.filter((issue) => issue.severity === "warning").length;

      const inserted = await db
        .insert(contentDrafts)
        .values({
          projectId: detail.project.id,
          sessionId,
          analysisId: succeeded.id,
          format,
          targetPlatform: CONTENT_FORMATS[format].platform,
          title: generated.title,
          body: generated.body,
          payload: generated.payload,
          status: "needs_review",
          currentVersion: 1,
        })
        .returning({ id: contentDrafts.id });

      const draftId = inserted[0].id;
      await db.insert(draftVersions).values({
        draftId,
        version: 1,
        title: generated.title,
        body: generated.body,
        payload: generated.payload,
        source: "ai",
      });

      if (generated.storyboard) {
        const board = await db
          .insert(storyboards)
          .values({
            draftId,
            targetDurationSec: generated.storyboard.targetDurationSec,
            totalDurationSec: generated.storyboard.totalDurationSec,
            hook: generated.storyboard.hook,
            cta: generated.storyboard.cta,
          })
          .returning({ id: storyboards.id });
        await db.insert(storyboardScenes).values(
          generated.storyboard.scenes.map((scene) => ({
            storyboardId: board[0].id,
            sceneIndex: scene.index,
            startSec: scene.startSec,
            durationSec: scene.durationSec,
            narration: scene.narration,
            onScreenText: scene.onScreenText,
            visualDirection: scene.visualDirection,
            sourceAssetId: scene.sourceAssetId,
            editingNotes: scene.editingNotes || null,
            transition: scene.transition || null,
          })),
        );
      }

      await db.insert(usageRecords).values({
        userId: owner.id,
        provider: generated.provider,
        task: `content:${format}`,
        model: generated.model,
        tokensIn: generated.tokensIn,
        tokensOut: generated.tokensOut,
        costUsd: generated.costUsd,
      });
      created.push(CONTENT_FORMATS[format].label);
    } catch (error) {
      failures.push(
        `${CONTENT_FORMATS[format].label}: ${
          error instanceof Error ? error.message : "generation failed"
        }`,
      );
    }
  }

  if (detail.session.status === "analyzed" && created.length > 0) {
    await db
      .update(buildSessions)
      .set({ status: "drafted", updatedAt: new Date() })
      .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, owner.id)));
  }

  if (created.length === 0) {
    redirectError(`/sessions/${sessionId}`, failures.join(" · ") || "No drafts were created.");
  }

  const message = [
    `Generated ${created.join(", ")}.`,
    warnings > 0 ? `${warnings} quality warning${warnings === 1 ? "" : "s"} to review.` : "",
    failures.length > 0 ? `Failed: ${failures.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  redirectSuccess(`/sessions/${sessionId}#drafts`, message);
}

export async function updateDraft(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const parsed = draftEditSchema.safeParse({
    draftId: formString(formData, "draftId"),
    title: formString(formData, "title"),
    body: formString(formData, "body"),
  });
  if (!parsed.success) {
    redirectError(`/studio/${formString(formData, "draftId")}`, formatZodError(parsed.error));
  }
  const owner = await getOwner();
  const detail = await getDraftDetail(owner.id, parsed.data.draftId);
  if (!detail) redirectError("/studio", "Draft not found.");

  const db = getDb();
  const nextVersion = detail.draft.currentVersion + 1;
  await db.insert(draftVersions).values({
    draftId: detail.draft.id,
    version: nextVersion,
    title: parsed.data.title || null,
    body: parsed.data.body,
    payload: detail.draft.payload ?? {},
    source: "user",
  });
  await db
    .update(contentDrafts)
    .set({
      title: parsed.data.title || null,
      body: parsed.data.body,
      currentVersion: nextVersion,
      status: "needs_review",
      updatedAt: new Date(),
    })
    .where(eq(contentDrafts.id, detail.draft.id));

  redirectSuccess(
    `/studio/${detail.draft.id}`,
    detail.draft.status === "approved"
      ? `Saved as version ${nextVersion}. The previously approved version ${detail.draft.approvedVersion} is preserved, but this edit needs re-approval.`
      : `Saved as version ${nextVersion}.`,
  );
}

export async function regenerateDraft(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const draftId = formString(formData, "draftId");
  if (!isAiConfigured()) {
    redirectError(`/studio/${draftId}`, "AI is not configured. Add provider keys to .env.local.");
  }
  const owner = await getOwner();
  const detail = await getDraftDetail(owner.id, draftId);
  if (!detail) redirectError("/studio", "Draft not found.");
  if (!detail.analysis?.summary) {
    redirectError(`/studio/${draftId}`, "The linked analysis is missing; regenerate it first.");
  }
  if (!detail.session) {
    redirectError(`/studio/${draftId}`, "The linked session is missing.");
  }
  const sessionDetail = await getSessionDetail(owner.id, detail.session.id);
  if (!sessionDetail) redirectError(`/studio/${draftId}`, "The linked session was not found.");

  const format = detail.draft.format as ContentFormatValue;
  const targetDuration =
    detail.storyboard?.targetDurationSec ?? 45;

  try {
    const generated = await generateDraftForFormat({
      detail: sessionDetail,
      analysis: detail.analysis.summary as Analysis,
      format,
      targetDurationSec: targetDuration,
      qualityFeedback: ["Regenerate with a stronger evidence-grounded hook than the previous draft."],
    });

    const db = getDb();
    const nextVersion = detail.draft.currentVersion + 1;
    await db.insert(draftVersions).values({
      draftId,
      version: nextVersion,
      title: generated.title,
      body: generated.body,
      payload: generated.payload,
      source: "ai",
    });
    await db
      .update(contentDrafts)
      .set({
        title: generated.title,
        body: generated.body,
        payload: generated.payload,
        currentVersion: nextVersion,
        status: "needs_review",
        updatedAt: new Date(),
      })
      .where(eq(contentDrafts.id, draftId));

    if (generated.storyboard) {
      await db.delete(storyboards).where(eq(storyboards.draftId, draftId));
      const board = await db
        .insert(storyboards)
        .values({
          draftId,
          targetDurationSec: generated.storyboard.targetDurationSec,
          totalDurationSec: generated.storyboard.totalDurationSec,
          hook: generated.storyboard.hook,
          cta: generated.storyboard.cta,
        })
        .returning({ id: storyboards.id });
      await db.insert(storyboardScenes).values(
        generated.storyboard.scenes.map((scene) => ({
          storyboardId: board[0].id,
          sceneIndex: scene.index,
          startSec: scene.startSec,
          durationSec: scene.durationSec,
          narration: scene.narration,
          onScreenText: scene.onScreenText,
          visualDirection: scene.visualDirection,
          sourceAssetId: scene.sourceAssetId,
          editingNotes: scene.editingNotes || null,
          transition: scene.transition || null,
        })),
      );
    }

    await db.insert(usageRecords).values({
      userId: owner.id,
      provider: generated.provider,
      task: `content:${format}`,
      model: generated.model,
      tokensIn: generated.tokensIn,
      tokensOut: generated.tokensOut,
      costUsd: generated.costUsd,
    });

    const warnings = generated.issues.filter((issue) => issue.severity === "warning").length;
    redirectSuccess(
      `/studio/${draftId}`,
      `Regenerated as version ${nextVersion}.${warnings ? ` ${warnings} quality warning(s).` : ""}`,
    );
  } catch (error) {
    redirectError(
      `/studio/${draftId}`,
      `Regeneration failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export async function approveDraft(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const draftId = formString(formData, "draftId");
  const note = formString(formData, "note");
  const owner = await getOwner();
  const detail = await getDraftDetail(owner.id, draftId);
  if (!detail) redirectError("/studio", "Draft not found.");
  if (detail.draft.status === "published") {
    redirectError(`/studio/${draftId}`, "Published drafts cannot be re-approved.");
  }
  const db = getDb();
  await db.insert(approvals).values({
    draftId,
    version: detail.draft.currentVersion,
    approvedBy: owner.email,
    note: note || null,
  });
  await db
    .update(contentDrafts)
    .set({
      status: "approved",
      approvedVersion: detail.draft.currentVersion,
      updatedAt: new Date(),
    })
    .where(eq(contentDrafts.id, draftId));

  redirectSuccess(
    `/studio/${draftId}`,
    `Approved version ${detail.draft.currentVersion}. Scheduling is still a manual step in this build.`,
  );
}

export async function archiveDraft(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/studio", "Database is not configured.");
  const draftId = formString(formData, "draftId");
  const owner = await getOwner();
  const detail = await getDraftDetail(owner.id, draftId);
  if (!detail) redirectError("/studio", "Draft not found.");
  const db = getDb();
  await db
    .update(contentDrafts)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(contentDrafts.id, draftId));
  redirect("/studio?message=Draft%20archived.");
}
