import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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
  publishingAccounts,
  recordings,
  renderJobs,
  scheduledPosts,
  sessionEvidence,
  storyboardScenes,
  storyboards,
  timelineProjects,
  timelineRenderJobs,
  transcriptionJobs,
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

export async function getTimelineDetail(userId: string, timelineId: string) {
  const db = getDb();
  const rows = await db
    .select({
      timeline: timelineProjects,
      project: projects,
      session: buildSessions,
      recording: recordings,
    })
    .from(timelineProjects)
    .innerJoin(projects, eq(timelineProjects.projectId, projects.id))
    .leftJoin(buildSessions, eq(timelineProjects.sessionId, buildSessions.id))
    .leftJoin(recordings, eq(timelineProjects.recordingId, recordings.id))
    .where(and(eq(timelineProjects.id, timelineId), eq(timelineProjects.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const assets = row.recording
    ? await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.recordingId, row.recording.id))
        .orderBy(mediaAssets.createdAt)
    : [];

  return { ...row, assets };
}

export type TimelineDetail = Awaited<ReturnType<typeof getTimelineDetail>>;

export async function listTimelines(userId: string) {
  const db = getDb();
  return db
    .select({
      timeline: timelineProjects,
      projectName: projects.name,
      sessionTitle: buildSessions.title,
      clipCount: sql<number>`(select coalesce(sum(jsonb_array_length(track->'clips')), 0)::int from jsonb_array_elements(${timelineProjects.document}->'tracks') as track)`,
    })
    .from(timelineProjects)
    .innerJoin(projects, eq(timelineProjects.projectId, projects.id))
    .leftJoin(buildSessions, eq(timelineProjects.sessionId, buildSessions.id))
    .where(eq(timelineProjects.userId, userId))
    .orderBy(desc(timelineProjects.updatedAt))
    .limit(50);
}

export async function listTimelinesForSession(userId: string, sessionId: string) {
  const db = getDb();
  return db
    .select({
      timeline: timelineProjects,
      clipCount: sql<number>`(select coalesce(sum(jsonb_array_length(track->'clips')), 0)::int from jsonb_array_elements(${timelineProjects.document}->'tracks') as track)`,
    })
    .from(timelineProjects)
    .where(
      and(
        eq(timelineProjects.userId, userId),
        eq(timelineProjects.sessionId, sessionId),
      ),
    )
    .orderBy(desc(timelineProjects.updatedAt))
    .limit(20);
}

export async function listTimelineRenderJobs(timelineId: string) {
  const db = getDb();
  return db
    .select({ job: timelineRenderJobs, mediaId: mediaAssets.id })
    .from(timelineRenderJobs)
    .leftJoin(mediaAssets, eq(mediaAssets.storageKey, timelineRenderJobs.outputKey))
    .where(eq(timelineRenderJobs.timelineId, timelineId))
    .orderBy(desc(timelineRenderJobs.createdAt))
    .limit(20);
}

export async function getTimelineTranscription(recordingId: string) {
  const db = getDb();
  const audioAssets = await db
    .select({ id: mediaAssets.id, track: mediaAssets.recordingTrack })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordingId, recordingId),
        inArray(mediaAssets.recordingTrack, ["microphone", "system"]),
      ),
    )
    .orderBy(mediaAssets.createdAt);
  if (audioAssets.length === 0) {
    return { transcript: null, job: null, assetId: null, hasAudio: false };
  }
  const primary =
    audioAssets.find((asset) => asset.track === "microphone") ?? audioAssets[0];
  const assetIds = audioAssets.map((asset) => asset.id);
  const [transcriptRows, jobRows] = await Promise.all([
    db
      .select()
      .from(transcripts)
      .where(inArray(transcripts.mediaAssetId, assetIds))
      .orderBy(desc(transcripts.createdAt)),
    db
      .select()
      .from(transcriptionJobs)
      .where(inArray(transcriptionJobs.mediaAssetId, assetIds))
      .orderBy(desc(transcriptionJobs.createdAt)),
  ]);
  const transcript =
    transcriptRows.find((item) => item.mediaAssetId === primary.id) ?? transcriptRows[0] ?? null;
  const primaryJob = jobRows.find((item) => item.mediaAssetId === primary.id);
  return {
    transcript,
    job: primaryJob ?? jobRows[0] ?? null,
    assetId: primary.id,
    hasAudio: true,
  };
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
  const count = sql<number>`count(*)::int`;
  const [
    projectRows,
    sessionRows,
    draftRows,
    reviewRows,
    approvedRows,
    publishedRows,
    failedRows,
    feedbackRows,
  ] = await Promise.all([
    db
      .select({ value: count })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.archivedAt))),
    db.select({ value: count }).from(buildSessions).where(eq(buildSessions.userId, userId)),
    db
      .select({ value: count })
      .from(contentDrafts)
      .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
      .where(eq(projects.userId, userId)),
    db
      .select({ value: count })
      .from(contentDrafts)
      .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, userId),
          sql`${contentDrafts.status} in ('draft','needs_review')`,
        ),
      ),
    db
      .select({ value: count })
      .from(contentDrafts)
      .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
      .where(and(eq(projects.userId, userId), eq(contentDrafts.status, "approved"))),
    db
      .select({ value: count })
      .from(contentDrafts)
      .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
      .where(and(eq(projects.userId, userId), eq(contentDrafts.status, "published"))),
    db
      .select({ value: count })
      .from(contentDrafts)
      .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
      .where(and(eq(projects.userId, userId), eq(contentDrafts.status, "failed"))),
    db
      .select({ value: count })
      .from(feedback)
      .innerJoin(projects, eq(feedback.projectId, projects.id))
      .where(eq(projects.userId, userId)),
  ]);

  const counts = {
    projectCount: projectRows[0]?.value ?? 0,
    sessionCount: sessionRows[0]?.value ?? 0,
    draftCount: draftRows[0]?.value ?? 0,
    reviewCount: reviewRows[0]?.value ?? 0,
    approvedCount: approvedRows[0]?.value ?? 0,
    publishedCount: publishedRows[0]?.value ?? 0,
    failedCount: failedRows[0]?.value ?? 0,
    feedbackCount: feedbackRows[0]?.value ?? 0,
  };

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
    counts,
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

export async function listProjectAccounts(userId: string, projectId: string) {
  const db = getDb();
  return db
    .select({
      account: publishingAccounts,
    })
    .from(publishingAccounts)
    .innerJoin(projects, eq(publishingAccounts.projectId, projects.id))
    .where(
      and(
        eq(publishingAccounts.projectId, projectId),
        eq(projects.userId, userId),
        eq(publishingAccounts.provider, "ghl"),
      ),
    )
    .orderBy(publishingAccounts.platform, publishingAccounts.displayName);
}

export async function listDraftPosts(draftId: string) {
  const db = getDb();
  return db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.draftId, draftId))
    .orderBy(desc(scheduledPosts.createdAt));
}

export async function listProjectPosts(userId: string, projectId: string) {
  const db = getDb();
  return db
    .select({ post: scheduledPosts, account: publishingAccounts })
    .from(scheduledPosts)
    .innerJoin(projects, eq(scheduledPosts.projectId, projects.id))
    .leftJoin(publishingAccounts, eq(scheduledPosts.accountId, publishingAccounts.id))
    .where(and(eq(scheduledPosts.projectId, projectId), eq(projects.userId, userId)))
    .orderBy(desc(scheduledPosts.createdAt))
    .limit(50);
}

export async function listRenderJobs(draftId: string) {
  const db = getDb();
  return db
    .select({ job: renderJobs, mediaId: mediaAssets.id })
    .from(renderJobs)
    .leftJoin(mediaAssets, eq(mediaAssets.storageKey, renderJobs.outputKey))
    .where(eq(renderJobs.draftId, draftId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(20);
}

export async function listRenderJobsForUser(userId: string) {
  const db = getDb();
  return db
    .select({
      job: renderJobs,
      draftTitle: contentDrafts.title,
      draftFormat: contentDrafts.format,
      projectName: projects.name,
      mediaId: mediaAssets.id,
    })
    .from(renderJobs)
    .innerJoin(contentDrafts, eq(renderJobs.draftId, contentDrafts.id))
    .innerJoin(projects, eq(contentDrafts.projectId, projects.id))
    .leftJoin(mediaAssets, eq(mediaAssets.storageKey, renderJobs.outputKey))
    .where(eq(projects.userId, userId))
    .orderBy(desc(renderJobs.createdAt))
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
