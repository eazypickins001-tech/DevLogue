"use server";

import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { aiAnalyses, buildSessions, usageRecords } from "@/db/schema";
import { getOwner, requireSession } from "@/lib/auth";
import { redirectError, redirectSuccess } from "@/lib/forms";
import { isAiConfigured } from "@/lib/env";
import { getSessionDetail } from "@/lib/queries";
import { analyzeSession as runAnalysis } from "@/lib/services/analysis";
import { formString } from "@/lib/validation";

export async function analyzeSession(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) redirectError("/sessions", "Database is not configured.");
  const sessionId = formString(formData, "sessionId");
  if (!isAiConfigured()) {
    redirectError(
      `/sessions/${sessionId}`,
      "AI is not configured. Add OPENROUTER_API_KEY and AI_MODEL to .env.local.",
    );
  }
  const owner = await getOwner();
  const detail = await getSessionDetail(owner.id, sessionId);
  if (!detail) redirectError("/sessions", "Session not found.");

  const db = getDb();
  try {
    const result = await runAnalysis(detail);
    const inserted = await db
      .insert(aiAnalyses)
      .values({
        sessionId,
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        summary: result.summary,
        evidenceGaps: result.summary.evidenceGaps,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: result.costUsd,
        status: "succeeded",
      })
      .returning({ id: aiAnalyses.id });

    await db.insert(usageRecords).values({
      userId: owner.id,
      provider: result.provider,
      task: "analysis",
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
    });

    if (detail.session.status === "captured") {
      await db
        .update(buildSessions)
        .set({ status: "analyzed", updatedAt: new Date() })
        .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, owner.id)));
    }

    const gaps = result.summary.evidenceGaps.length;
    redirectSuccess(
      `/sessions/${sessionId}#analysis`,
      gaps > 0
        ? `Analysis ${inserted[0].id.slice(0, 8)} created with ${gaps} evidence gap${gaps === 1 ? "" : "s"} to review.`
        : "Analysis created.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    await db.insert(aiAnalyses).values({
      sessionId,
      provider: process.env.AI_PROVIDER ?? "openrouter",
      model: process.env.AI_MODEL_ANALYSIS ?? process.env.AI_MODEL ?? "unknown",
      status: "failed",
      error: message.slice(0, 1000),
    });
    redirectError(`/sessions/${sessionId}`, `Analysis failed: ${message}`);
  }
}
