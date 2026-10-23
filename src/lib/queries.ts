import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiAnalyses,
  approvals,
  buildSessions,
  contentDrafts,
  draftVersions,
  feedback,
  mediaAssets,
  projects,
  scheduledPosts,
  sessionEvidence,
  storyboardScenes,
  storyboards,
  transcripts,
  usageRecords,
} from "@/db/schema";

export async function listProjects(userId: string, includeArchived = false) {
  const db = getDb();
  const where = includeArchived
    ? eq(projects.userId, userId)
    : and(eq(projects.userId, userId), isNull(projects.archivedAt));
  return db
    .select({
      project: projects,
      sessionCount: sql<number>`(select count(*)::int from ${buildSessions} where ${buildSessions.projectId} = ${projects.id})`,
      draftCount: sql<number>`(select count(*)::int from ${contentDrafts} where ${contentDrafts.projectId} = ${projects.id})`,
    })
    .from(projects)
    .where(where)
    .orderBy(desc(projects.createdAt));
}

export async function getProject(userId: string, projectId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSessions(userId: string, projectId?: string) {
  const db = getDb();
  const conditions = projectId
    ? and(eq(buildSessions.userId, userId), eq(buildSessions.projectId, projectId))
    : eq(buildSessions.userId, userId);
  return db
    .select({
      session: buildSessions,
      projectName: projects.name,
      evidenceCount: sql<number>`(select count(*)::int from ${sessionEvidence} where ${sessionEvidence.sessionId} = ${buildSessions.id})`,
      draftCount: sql<number>`(select count(*)::int from ${contentDrafts} where ${contentDrafts.sessionId} = ${buildSessions.id})`,
    })
    .from(buildSessions)
    .innerJoin(projects, eq(buildSessions.projectId, projects.id))
    .where(conditions)
    .orderBy(desc(buildSessions.createdAt))
    .limit(100);
}

export type SessionDetail = Awaited<ReturnType<typeof getSessionDetail>>;

export async function getSessionDetail(userId: string, sessionId: string) {
  const db = getDb();
  const rows = await db
    .select({ session: buildSessions, project: projects })
    .from(buildSessions)
    .innerJoin(projects, eq(buildSessions.projectId, projects.id))
    .where(and(eq(buildSessions.id, sessionId), eq(buildSessions.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [evidence, media, analyses, drafts] = await Promise.all([
    db
      .select()
      .from(sessionEvidence)
      .where(eq(sessionEvidence.sessionId, sessionId))
      .orderBy(desc(sessionEvidence.createdAt)),
    db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.sessionId, sessionId))
      .orderBy(desc(mediaAssets.createdAt)),
    db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.sessionId, sessionId))
      .orderBy(desc(aiAnalyses.createdAt)),
    db
      .select()
      .from(contentDrafts)
      .where(eq(contentDrafts.sessionId, sessionId))
      .orderBy(desc(contentDrafts.createdAt)),
  ]);

  return { ...row, evidence, media, analyses, drafts };
}

export async function latestAnalysis(sessionId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(aiAnalyses)
    .where(and(eq(aiAnalyses.sessionId, sessionId), eq(aiAnalyses.status, "succeeded")))
    .orderBy(desc(aiAnalyses.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDrafts(userId: string, filters?: { status?: string; format?: string }) {
  const db = getDb();
  const conditions = [eq(projects.userId, userId)];
  if (filters?.status) {
    conditions.push(eq(contentDrafts.status, filters.status as "draft"));
  }
  if (filters?.format) {
    conditions.push(eq(contentDrafts.format, filters.format as "linkedin_post"));
  }
  return db
    .select({
      draft: contentDrafts,
      projectName: projects.name,
      sessionTitle: buildSessions.title,
    })
    .from(contentDrafts)
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .leftJoin(buildSessions, eq(contentDrafts.sessionId, buildSessions.id))
    .where(and(...conditions))
    .orderBy(desc(contentDrafts.updatedAt))
    .limit(200);
}

export async function listDraftsForProject(userId: string, projectId: string) {
  const db = getDb();
  const rows = await db
    .select({ draft: contentDrafts })
    .from(contentDrafts)
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .orderBy(desc(contentDrafts.updatedAt))
    .limit(20);
  return rows.map((row) => row.draft);
}

export async function getDraftDetail(userId: string, draftId: string) {
  const db = getDb();
  const rows = await db
    .select({
      draft: contentDrafts,
      project: projects,
      session: buildSessions,
      analysis: aiAnalyses,
    })
    .from(contentDrafts)
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .leftJoin(buildSessions, eq(contentDrafts.sessionId, buildSessions.id))
    .leftJoin(aiAnalyses, eq(contentDrafts.analysisId, aiAnalyses.id))
    .where(and(eq(contentDrafts.id, draftId), eq(projects.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [versions, approvalRows, boardRows] = await Promise.all([
    db
      .select()
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draftId))
      .orderBy(desc(draftVersions.version)),
    db.select().from(approvals).where(eq(approvals.draftId, draftId)).orderBy(desc(approvals.approvedAt)),
    db.select().from(storyboards).where(eq(storyboards.draftId, draftId)).limit(1),
  ]);

  const board = boardRows[0] ?? null;
  const scenes = board
    ? await db
        .select()
        .from(storyboardScenes)
        .where(eq(storyboardScenes.storyboardId, board.id))
        .orderBy(storyboardScenes.sceneIndex)
    : [];

  return { ...row, versions, approvals: approvalRows, storyboard: board, scenes };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(userId: string) {
  const db = getDb();
  const [counts] = await db
    .select({
      projectCount: sql<number>`(select count(*)::int from ${projects} where ${projects.userId} = ${userId} and ${projects.archivedAt} is null)`,
      sessionCount: sql<number>`(select count(*)::int from ${buildSessions} where ${buildSessions.userId} = ${userId})`,
      draftCount: sql<number>`(select count(*)::int from ${contentDrafts} inner join ${projects} on ${contentDrafts.projectId} = ${projects.id} where ${projects.userId} = ${userId})`,
      reviewCount: sql<number>`(select count(*)::int from ${contentDrafts} inner join ${projects} on ${contentDrafts.projectId} = ${projects.id} where ${projects.userId} = ${userId} and ${contentDrafts.status} in ('draft','needs_review'))`,
      approvedCount: sql<number>`(select count(*)::int from ${contentDrafts} inner join ${projects} on ${contentDrafts.projectId} = ${projects.id} where ${projects.userId} = ${userId} and ${contentDrafts.status} = 'approved')`,
      publishedCount: sql<number>`(select count(*)::int from ${contentDrafts} inner join ${projects} on ${contentDrafts.projectId} = ${projects.id} where ${projects.userId} = ${userId} and ${contentDrafts.status} = 'published')`,
      failedCount: sql<number>`(select count(*)::int from ${contentDrafts} inner join ${projects} on ${contentDrafts.projectId} = ${projects.id} where ${projects.userId} = ${userId} and ${contentDrafts.status} = 'failed')`,
      feedbackCount: sql<number>`(select count(*)::int from ${feedback} inner join ${projects} on ${feedback.projectId} = ${projects.id} where ${projects.userId} = ${userId})`,
    })
    .from(projects)
    .limit(1);

  const [recentSessions, reviewDrafts, upcoming, recentFeedback, latestUsage] = await Promise.all([
    db
      .select({ session: buildSessions, projectName: projects.name })
      .from(buildSessions)
      .innerJoin(projects, eq(buildSessions.projectId, projects.id))
      .where(eq(buildSessions.userId, userId))
      .orderBy(desc(buildSessions.createdAt))
      .limit(5),
    db
      .select({ draft: contentDrafts, projectName: projects.name })
      .from(contentDrafts)
      .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, userId),
          sql`${contentDrafts.status} in ('draft','needs_review')`,
        ),
      )
      .orderBy(desc(contentDrafts.updatedAt))
      .limit(5),
    db
      .select({ post: scheduledPosts, projectName: projects.name })
      .from(scheduledPosts)
      .innerJoin(projects, eq(scheduledPosts.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, userId),
          sql`${scheduledPosts.status} in ('scheduled','publishing')`,
        ),
      )
      .orderBy(scheduledPosts.scheduledAt)
      .limit(5),
    db
      .select({ item: feedback, projectName: projects.name })
      .from(feedback)
      .innerJoin(projects, eq(feedback.projectId, projects.id))
      .where(eq(projects.userId, userId))
      .orderBy(desc(feedback.createdAt))
      .limit(3),
    db
      .select({
        totalTokensIn: sql<number>`coalesce(sum(${usageRecords.tokensIn}), 0)::int`,
        totalTokensOut: sql<number>`coalesce(sum(${usageRecords.tokensOut}), 0)::int`,
        totalCost: sql<string | null>`sum(${usageRecords.costUsd})`,
        calls: sql<number>`count(*)::int`,
      })
      .from(usageRecords)
      .where(eq(usageRecords.userId, userId)),
  ]);

  return {
    counts: counts ?? {
      projectCount: 0,
      sessionCount: 0,
      draftCount: 0,
      reviewCount: 0,
      approvedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      feedbackCount: 0,
    },
    recentSessions,
    reviewDrafts,
    upcoming,
    recentFeedback,
    usage: latestUsage[0] ?? { totalTokensIn: 0, totalTokensOut: 0, totalCost: null, calls: 0 },
  };
}

export async function listFeedback(userId: string) {
  const db = getDb();
  return db
    .select({ item: feedback, projectName: projects.name })
    .from(feedback)
    .innerJoin(projects, eq(feedback.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(feedback.createdAt))
    .limit(100);
}

export async function listStoryboardDrafts(userId: string) {
  const db = getDb();
  return db
    .select({
      draft: contentDrafts,
      board: storyboards,
      projectName: projects.name,
      sceneCount: sql<number>`(select count(*)::int from ${storyboardScenes} where ${storyboardScenes.storyboardId} = ${storyboards.id})`,
      linkedScenes: sql<number>`(select count(*)::int from ${storyboardScenes} where ${storyboardScenes.storyboardId} = ${storyboards.id} and ${storyboardScenes.sourceAssetId} is not null)`,
    })
    .from(storyboards)
    .innerJoin(contentDrafts, eq(storyboards.draftId, contentDrafts.id))
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(storyboards.createdAt))
    .limit(50);
}

export async function listApprovedDrafts(userId: string) {
  const db = getDb();
  return db
    .select({ draft: contentDrafts, projectName: projects.name })
    .from(contentDrafts)
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .where(and(eq(projects.userId, userId), eq(contentDrafts.status, "approved")))
    .orderBy(desc(contentDrafts.updatedAt))
    .limit(50);
}

export async function listScheduledPosts(userId: string) {
  const db = getDb();
  return db
    .select({
      post: scheduledPosts,
      projectName: projects.name,
      draftTitle: contentDrafts.title,
      draftFormat: contentDrafts.format,
      draftStatus: contentDrafts.status,
    })
    .from(scheduledPosts)
    .innerJoin(projects, eq(scheduledPosts.projectId, projects.id))
    .innerJoin(contentDrafts, eq(scheduledPosts.draftId, contentDrafts.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(scheduledPosts.scheduledAt))
    .limit(100);
}

export async function listUsage(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(50);
}

export async function listMediaAssets(userId: string, sessionId?: string) {
  const db = getDb();
  const where = sessionId
    ? and(eq(mediaAssets.userId, userId), eq(mediaAssets.sessionId, sessionId))
    : eq(mediaAssets.userId, userId);
  return db.select().from(mediaAssets).where(where).orderBy(desc(mediaAssets.createdAt)).limit(100);
}

export async function getTranscript(mediaAssetId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.mediaAssetId, mediaAssetId))
    .orderBy(desc(transcripts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
