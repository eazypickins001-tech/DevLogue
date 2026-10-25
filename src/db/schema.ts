import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { TimelineDocument } from "../lib/timeline/model";

export const projectStage = pgEnum("project_stage", [
  "idea",
  "validating",
  "building",
  "beta",
  "launched",
  "archived",
]);

export const sessionStatus = pgEnum("session_status", [
  "captured",
  "analyzed",
  "drafted",
  "archived",
]);

export const evidenceKind = pgEnum("evidence_kind", [
  "commit",
  "pull_request",
  "release",
  "issue",
  "screenshot",
  "recording",
  "note",
  "transcript",
  "link",
  "other",
]);

export const mediaKind = pgEnum("media_kind", [
  "image",
  "video",
  "audio",
  "document",
]);

export const draftFormat = pgEnum("draft_format", [
  "short_video",
  "instagram_caption",
  "linkedin_post",
  "x_post",
  "x_thread",
  "youtube_title",
  "youtube_description",
  "youtube_outline",
  "tutorial_script",
  "changelog",
  "lesson_learned",
  "problem_solution_story",
  "launch_announcement",
  "waitlist_invite",
  "case_study",
]);

export const draftStatus = pgEnum("draft_status", [
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "archived",
]);

export const draftSource = pgEnum("draft_source", ["ai", "user"]);

export const platform = pgEnum("platform", [
  "instagram",
  "youtube",
  "linkedin",
  "x",
  "tiktok",
  "facebook",
  "threads",
  "bluesky",
  "other",
]);

export const publishStatus = pgEnum("publish_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "archived",
]);

export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const feedbackKind = pgEnum("feedback_kind", [
  "feature_request",
  "bug_report",
  "question",
  "potential_customer",
  "early_tester",
  "general",
  "other",
]);

export const integrationStatus = pgEnum("integration_status", [
  "unconfigured",
  "configured",
  "connected",
  "error",
]);

export const renderStatus = pgEnum("render_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export type StoryboardScenePayload = {
  index: number;
  startSec: number;
  durationSec: number;
  narration: string;
  onScreenText: string;
  visualDirection: string;
  sourceAssetId: string | null;
  editingNotes: string;
  transition: string;
};

export type AnalysisClaim = {
  text: string;
  evidenceIds: string[];
  verified: boolean;
};

export type SessionAnalysisPayload = {
  problem: string;
  attemptedSolution: string;
  actualChanges: string[];
  evidence: string[];
  tests: string[];
  failures: string[];
  lessons: string[];
  status: string;
  openQuestions: string[];
  bestDemo: string;
  audienceBenefit: string;
  contentAngles: string[];
  evidenceGaps: string[];
  claims: AnalysisClaim[];
};

export type TranscriptSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const loginTokens = pgTable(
  "login_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("login_tokens_email_created_idx").on(table.email, table.createdAt),
    index("login_tokens_expires_idx").on(table.expiresAt),
  ],
);
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    problem: text("problem"),
    targetUsers: text("target_users"),
    stage: projectStage("stage").notNull().default("building"),
    repoUrl: text("repo_url"),
    workingDir: text("working_dir"),
    goals: text("goals").array().notNull().default([]),
    positioning: text("positioning"),
    tone: text("tone"),
    platforms: platform("platforms").array().notNull().default([]),
    launchStatus: text("launch_status"),
    landingPageUrl: text("landing_page_url"),
    waitlistUrl: text("waitlist_url"),
    feedbackUrl: text("feedback_url"),
    sensitiveNotes: text("sensitive_notes"),
    publicationExclusions: text("publication_exclusions"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_user_slug_unique").on(table.userId, table.slug),
    index("projects_user_idx").on(table.userId),
  ],
);

export const buildSessions = pgTable(
  "build_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    workedOn: text("worked_on").notNull(),
    problem: text("problem"),
    whyItMatters: text("why_it_matters"),
    changes: text("changes"),
    learned: text("learned"),
    worked: text("worked"),
    failed: text("failed"),
    unfinished: text("unfinished"),
    nextTask: text("next_task"),
    publishable: boolean("publishable").notNull().default(false),
    status: sessionStatus("status").notNull().default("captured"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("build_sessions_project_idx").on(table.projectId),
    index("build_sessions_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const sessionEvidence = pgTable(
  "session_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => buildSessions.id, { onDelete: "cascade" }),
    kind: evidenceKind("kind").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    externalRef: text("external_ref"),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("session_evidence_session_idx").on(table.sessionId)],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => buildSessions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    source: text("source").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    cameraVisible: boolean("camera_visible").notNull().default(true),
    durationSeconds: numeric("duration_seconds", { precision: 10, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("ready"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recordings_user_idx").on(table.userId),
    index("recordings_session_idx").on(table.sessionId),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => buildSessions.id, { onDelete: "cascade" }),
    recordingId: uuid("recording_id").references(() => recordings.id, { onDelete: "set null" }),
    recordingTrack: text("recording_track"),
    kind: mediaKind("kind").notNull(),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    isPrivate: boolean("is_private").notNull().default(true),
    durationSeconds: numeric("duration_seconds", { precision: 10, scale: 2 }),
    width: integer("width"),
    height: integer("height"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_storage_key_unique").on(table.storageKey),
    index("media_assets_project_idx").on(table.projectId),
    index("media_assets_session_idx").on(table.sessionId),
    index("media_assets_recording_idx").on(table.recordingId),
  ],
);

export const multipartUploads = pgTable(
  "multipart_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => buildSessions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    uploadId: text("upload_id").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    partSize: integer("part_size").notNull(),
    partCount: integer("part_count").notNull(),
    status: text("status").notNull().default("uploading"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("multipart_uploads_key_unique").on(table.key),
    index("multipart_uploads_user_idx").on(table.userId),
    index("multipart_uploads_session_idx").on(table.sessionId),
  ],
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    language: text("language").notNull().default("en"),
    text: text("text").notNull(),
    segments: jsonb("segments").$type<TranscriptSegment[]>().notNull().default([]),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transcripts_media_idx").on(table.mediaAssetId)],
);

export const transcriptionJobs = pgTable(
  "transcription_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    status: renderStatus("status").notNull().default("queued"),
    language: text("language").notNull().default("en"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transcription_jobs_media_idx").on(table.mediaAssetId, table.createdAt),
    index("transcription_jobs_status_idx").on(table.status, table.createdAt),
  ],
);

export const timelineProjects = pgTable(
  "timeline_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => buildSessions.id, { onDelete: "cascade" }),
    recordingId: uuid("recording_id").references(() => recordings.id, { onDelete: "set null" }),
    draftId: uuid("draft_id").references(() => contentDrafts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    fps: integer("fps").notNull().default(30),
    durationSeconds: numeric("duration_seconds", { precision: 10, scale: 2 }).notNull().default("0"),
    document: jsonb("document").$type<TimelineDocument>().notNull(),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("timeline_projects_user_idx").on(table.userId),
    index("timeline_projects_session_idx").on(table.sessionId),
    index("timeline_projects_recording_idx").on(table.recordingId),
  ],
);

export const timelineRenderJobs = pgTable(
  "timeline_render_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    timelineId: uuid("timeline_id")
      .notNull()
      .references(() => timelineProjects.id, { onDelete: "cascade" }),
    status: renderStatus("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    outputKey: text("output_key"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("timeline_render_jobs_timeline_idx").on(table.timelineId, table.createdAt)],
);

export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => buildSessions.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull().default("v1"),
    summary: jsonb("summary").$type<SessionAnalysisPayload>(),
    evidenceGaps: jsonb("evidence_gaps").$type<string[]>().notNull().default([]),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    status: jobStatus("status").notNull().default("queued"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_analyses_session_idx").on(table.sessionId, table.createdAt)],
);

export const contentDrafts = pgTable(
  "content_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => buildSessions.id, { onDelete: "set null" }),
    analysisId: uuid("analysis_id").references(() => aiAnalyses.id, { onDelete: "set null" }),
    format: draftFormat("format").notNull(),
    targetPlatform: platform("target_platform").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    status: draftStatus("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(1),
    approvedVersion: integer("approved_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("content_drafts_project_idx").on(table.projectId, table.createdAt),
    index("content_drafts_session_idx").on(table.sessionId),
    index("content_drafts_status_idx").on(table.status),
  ],
);

export const draftVersions = pgTable(
  "draft_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => contentDrafts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    source: draftSource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("draft_versions_draft_version_unique").on(table.draftId, table.version)],
);

export const storyboards = pgTable(
  "storyboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => contentDrafts.id, { onDelete: "cascade" }),
    targetDurationSec: integer("target_duration_sec").notNull(),
    totalDurationSec: integer("total_duration_sec").notNull(),
    hook: text("hook").notNull(),
    cta: text("cta").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("storyboards_draft_unique").on(table.draftId)],
);

export const storyboardScenes = pgTable(
  "storyboard_scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyboardId: uuid("storyboard_id")
      .notNull()
      .references(() => storyboards.id, { onDelete: "cascade" }),
    sceneIndex: integer("scene_index").notNull(),
    startSec: integer("start_sec").notNull(),
    durationSec: integer("duration_sec").notNull(),
    narration: text("narration").notNull(),
    onScreenText: text("on_screen_text").notNull(),
    visualDirection: text("visual_direction").notNull(),
    sourceAssetId: uuid("source_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    editingNotes: text("editing_notes"),
    transition: text("transition"),
  },
  (table) => [
    uniqueIndex("storyboard_scenes_order_unique").on(table.storyboardId, table.sceneIndex),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => contentDrafts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    approvedBy: text("approved_by").notNull(),
    note: text("note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("approvals_draft_idx").on(table.draftId)],
);

export const publishingAccounts = pgTable(
  "publishing_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("ghl"),
    externalAccountId: text("external_account_id").notNull(),
    platform: platform("platform").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("publishing_accounts_unique").on(
      table.projectId,
      table.provider,
      table.externalAccountId,
    ),
  ],
);

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => contentDrafts.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => publishingAccounts.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull().default("ghl"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("UTC"),
    status: publishStatus("status").notNull().default("draft"),
    externalPostId: text("external_post_id"),
    externalUrl: text("external_url"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scheduled_posts_project_time_idx").on(table.projectId, table.scheduledAt),
    index("scheduled_posts_draft_idx").on(table.draftId),
  ],
);

export const publishingJobs = pgTable(
  "publishing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduledPostId: uuid("scheduled_post_id")
      .notNull()
      .references(() => scheduledPosts.id, { onDelete: "cascade" }),
    status: jobStatus("status").notNull().default("queued"),
    request: jsonb("request").$type<Record<string, unknown>>(),
    response: jsonb("response").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("publishing_jobs_post_idx").on(table.scheduledPostId)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: feedbackKind("kind").notNull().default("general"),
    source: text("source").notNull().default("manual"),
    contact: text("contact"),
    body: text("body").notNull(),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("feedback_project_idx").on(table.projectId, table.createdAt)],
);

export const waitingListRefs = pgTable(
  "waiting_list_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    signups: integer("signups"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("waiting_list_project_idx").on(table.projectId)],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    task: text("task").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("usage_records_user_idx").on(table.userId, table.createdAt)],
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: integrationStatus("status").notNull().default("unconfigured"),
    config: jsonb("config").$type<Record<string, string>>(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("integrations_user_provider_unique").on(table.userId, table.provider)],
);

export const renderJobs = pgTable(
  "render_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => contentDrafts.id, { onDelete: "cascade" }),
    status: renderStatus("status").notNull().default("queued"),
    command: jsonb("command").$type<Record<string, unknown>>(),
    outputKey: text("output_key"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("render_jobs_draft_idx").on(table.draftId, table.createdAt)],
);
