import "server-only";

import { analysisSchema, type Analysis } from "@/lib/ai/schemas";
import { buildAnalysisPrompt, PROMPT_VERSION } from "@/lib/ai/prompts";
import { generateStructured } from "@/lib/ai/provider";
import type { SessionDetail } from "@/lib/queries";

export type AnalysisResult = {
  summary: Analysis;
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
  promptVersion: string;
};

export async function analyzeSession(detail: NonNullable<SessionDetail>): Promise<AnalysisResult> {
  const { session, project, evidence, media } = detail;
  const prompt = buildAnalysisPrompt({
    project: {
      name: project.name,
      description: project.description ?? "",
      targetUsers: project.targetUsers ?? "",
      positioning: project.positioning ?? "",
      tone: project.tone ?? "",
      stage: project.stage,
    },
    session: {
      title: session.title,
      workedOn: session.workedOn,
      problem: session.problem ?? "",
      whyItMatters: session.whyItMatters ?? "",
      changes: session.changes ?? "",
      learned: session.learned ?? "",
      worked: session.worked ?? "",
      failed: session.failed ?? "",
      unfinished: session.unfinished ?? "",
      nextTask: session.nextTask ?? "",
    },
    evidence: evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body ?? "",
      url: item.url ?? "",
      verified: item.verified,
    })),
    knownAssets: media.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      filename: asset.filename,
      notes: asset.notes ?? "",
    })),
  });

  const generation = await generateStructured({
    task: "analysis",
    system: prompt.system,
    user: prompt.user,
    schema: analysisSchema,
    schemaName: "session_analysis",
  });

  return {
    summary: generation.data,
    provider: generation.provider,
    model: generation.model,
    tokensIn: generation.tokensIn,
    tokensOut: generation.tokensOut,
    costUsd: generation.costUsd,
    promptVersion: PROMPT_VERSION,
  };
}
