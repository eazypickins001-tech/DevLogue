CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"session_id" uuid,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"camera_visible" boolean DEFAULT true NOT NULL,
	"duration_seconds" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"session_id" uuid,
	"recording_id" uuid,
	"draft_id" uuid,
	"title" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"fps" integer DEFAULT 30 NOT NULL,
	"duration_seconds" numeric(10, 2) DEFAULT '0' NOT NULL,
	"document" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_render_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timeline_id" uuid NOT NULL,
	"status" "render_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"output_key" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "recording_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "recording_track" text;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_session_id_build_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."build_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_projects" ADD CONSTRAINT "timeline_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_projects" ADD CONSTRAINT "timeline_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_projects" ADD CONSTRAINT "timeline_projects_session_id_build_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."build_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_projects" ADD CONSTRAINT "timeline_projects_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_projects" ADD CONSTRAINT "timeline_projects_draft_id_content_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."content_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_render_jobs" ADD CONSTRAINT "timeline_render_jobs_timeline_id_timeline_projects_id_fk" FOREIGN KEY ("timeline_id") REFERENCES "public"."timeline_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordings_user_idx" ON "recordings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recordings_session_idx" ON "recordings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "timeline_projects_user_idx" ON "timeline_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "timeline_projects_session_idx" ON "timeline_projects" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "timeline_projects_recording_idx" ON "timeline_projects" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "timeline_render_jobs_timeline_idx" ON "timeline_render_jobs" USING btree ("timeline_id","created_at");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_recording_idx" ON "media_assets" USING btree ("recording_id");