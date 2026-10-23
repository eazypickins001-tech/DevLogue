import "server-only";

import type { Analysis } from "@/lib/ai/schemas";
import {
  formatSchemaFor,
  payloadTitle,
  payloadToBody,
  storyboardSchema,
} from "@/lib/ai/schemas";
import { buildContentPrompt, schemaDescription } from "@/lib/ai/prompts";
import { generateStructured } from "@/lib/ai/provider";
import {
  CONTENT_FORMATS,
  lintContent,
  type ContentFormatValue,
  type LintIssue,
} from "@/lib/domain/content";
import {
  normalizeStoryboard,
  storyboardIssues,
  type NormalizedScene,
} from "@/lib/domain/storyboard";
import type { SessionDetail } from "@/lib/queries";

export type GeneratedDraft = {
  format: ContentFormatValue;
  title: string | null;
  body: string;
  payload: Record<string, unknown>;
  issues: LintIssue[];
  storyboard:
    | {
        hook: string;
        cta: string;
        targetDurationSec: number;
        totalDurationSec: number;
        scenes: NormalizedScene[];
      }
    | null;
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
};

export function buildEvidenceCorpus(detail: NonNullable<SessionDetail>): string {
  const { session, evidence, media } = detail;
  return [
    `Session: ${session.title}`,
    `Worked on: ${session.workedOn}`,
    session.problem ? `Problem: ${session.problem}` : "",
    session.whyItMatters ? `Why it matters: ${session.whyItMatters}` : "",
    session.changes ? `Changes: ${session.changes}` : "",
    session.worked ? `What worked: ${session.worked}` : "",
    session.failed ? `What failed: ${session.failed}` : "",
    session.learned ? `Learned: ${session.learned}` : "",
    session.unfinished ? `Unfinished: ${session.unfinished}` : "",
    session.nextTask ? `Next task: ${session.nextTask}` : "",
    ...evidence.map(
      (item) =>
        `Evidence [${item.id}] (${item.kind}${item.verified ? ", verified" : ", unverified"}): ${item.title}${
          item.body ? ` — ${item.body}` : ""
        }${item.url ? ` (${item.url})` : ""}`,
    ),
    ...media.map((asset) => `Media [${asset.id}] ${asset.kind}: ${asset.filename} ${asset.notes ?? ""}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateDraftForFormat(input: {
  detail: NonNullable<SessionDetail>;
  analysis: Analysis;
  format: ContentFormatValue;
  targetDurationSec: number;
  qualityFeedback?: string[];
}): Promise<GeneratedDraft> {
  const { detail, analysis, format } = input;
  const spec = CONTENT_FORMATS[format];
  const corpus = buildEvidenceCorpus(detail);
  const schema = formatSchemaFor(format);
  const assetIds = new Set(detail.media.map((asset) => asset.id));

  const prompt = buildContentPrompt({
    project: {
      name: detail.project.name,
      description: detail.project.description ?? "",
      targetUsers: detail.project.targetUsers ?? "",
      positioning: detail.project.positioning ?? "",
      tone: detail.project.tone ?? "",
      stage: detail.project.stage,
    },
    session: {
      title: detail.session.title,
      workedOn: detail.session.workedOn,
      problem: detail.session.problem ?? "",
      whyItMatters: detail.session.whyItMatters ?? "",
      changes: detail.session.changes ?? "",
      learned: detail.session.learned ?? "",
      worked: detail.session.worked ?? "",
      failed: detail.session.failed ?? "",
      unfinished: detail.session.unfinished ?? "",
      nextTask: detail.session.nextTask ?? "",
    },
    analysis: analysis as unknown as Record<string, unknown>,
    format,
    targetDurationSec: input.targetDurationSec,
    evidenceCorpus: corpus,
    assets: detail.media.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      filename: asset.filename,
      notes: asset.notes ?? "",
    })),
    schemaJson: schemaDescription(schema),
    qualityFeedback: input.qualityFeedback,
  });

  const generation = await generateStructured({
    task: "content",
    system: prompt.system,
    user: prompt.user,
    schema,
    schemaName: `content_${format}`,
  });

  const payload = generation.data as Record<string, unknown>;
  let storyboard: GeneratedDraft["storyboard"] = null;

  if (format === "short_video") {
    const parsed = storyboardSchema.parse(payload);
    for (const scene of parsed.scenes) {
      if (scene.sourceAssetId && !assetIds.has(scene.sourceAssetId)) {
        scene.sourceAssetId = null;
      }
    }
    const normalized = normalizeStoryboard(parsed.scenes, input.targetDurationSec);
    storyboard = {
      hook: parsed.hook,
      cta: parsed.cta,
      targetDurationSec: Math.max(
        parsed.scenes.length * 2,
        Math.round(input.targetDurationSec),
      ),
      totalDurationSec: normalized.totalDurationSec,
      scenes: normalized.scenes,
    };
    payload.scenes = normalized.scenes.map((scene) => ({
      ...scene,
      sourceAssetId: scene.sourceAssetId,
    }));
    payload.totalDurationSec = normalized.totalDurationSec;
  }

  const body = payloadToBody(format, payload);
  const issues: LintIssue[] = [];

  if (format === "x_thread") {
    const posts = Array.isArray(payload.posts) ? (payload.posts as string[]) : [];
    posts.forEach((post, index) => {
      for (const issue of lintContent(post, { platform: "x", minChars: 20 })) {
        issues.push({ ...issue, message: `Post ${index + 1}: ${issue.message}` });
      }
    });
  } else if (format === "short_video" && storyboard) {
    for (const issue of lintContent(`${storyboard.hook}\n${storyboard.cta}`, {
      evidenceCorpus: corpus,
      minChars: 10,
    })) {
      issues.push(issue);
    }
    for (const message of storyboardIssues({
      targetDurationSec: storyboard.targetDurationSec,
      totalDurationSec: storyboard.totalDurationSec,
      scenes: storyboard.scenes,
    })) {
      issues.push({ code: "storyboard", severity: "error", message });
    }
    for (const scene of storyboard.scenes) {
      for (const issue of lintContent(scene.narration, { minChars: 8 })) {
        issues.push({
          ...issue,
          message: `Scene ${scene.index + 1}: ${issue.message}`,
        });
      }
    }
  } else {
    issues.push(
      ...lintContent(body, {
        platform: spec.platform,
        evidenceCorpus: corpus,
        minChars: 20,
      }),
    );
  }

  return {
    format,
    title: payloadTitle(format, payload) ?? (storyboard ? storyboard.hook : null),
    body,
    payload,
    issues,
    storyboard,
    provider: generation.provider,
    model: generation.model,
    tokensIn: generation.tokensIn,
    tokensOut: generation.tokensOut,
    costUsd: generation.costUsd,
  };
}
