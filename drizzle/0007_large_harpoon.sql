CREATE TYPE "public"."error_incident_status" AS ENUM('new', 'acknowledged', 'investigating', 'fixed', 'verified', 'archived', 'wont_fix');--> statement-breakpoint
CREATE TYPE "public"."error_severity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."error_source" AS ENUM('server', 'client', 'worker', 'smoke', 'manual');--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "error_source" DEFAULT 'server' NOT NULL,
	"severity" "error_severity" DEFAULT 'error' NOT NULL,
	"environment" text,
	"release" text,
	"route" text,
	"action" text,
	"request_id" text,
	"trace_id" text,
	"job_type" text,
	"job_id" text,
	"project_id" uuid,
	"session_id" uuid,
	"timeline_id" uuid,
	"media_id" uuid,
	"error_name" text,
	"message" text NOT NULL,
	"stack" text,
	"cause" text,
	"context" jsonb,
	"breadcrumbs" jsonb,
	"user_agent" text,
	"redacted" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_incident_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"actor" text DEFAULT 'owner' NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"severity" "error_severity" DEFAULT 'error' NOT NULL,
	"status" "error_incident_status" DEFAULT 'new' NOT NULL,
	"source" "error_source" DEFAULT 'server' NOT NULL,
	"environment" text,
	"release" text,
	"route" text,
	"action" text,
	"error_name" text,
	"error_message" text NOT NULL,
	"top_frame" text,
	"cause" text,
	"context" jsonb,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"regression_count" integer DEFAULT 0 NOT NULL,
	"fix_commit" text,
	"resolution_summary" text,
	"verification_method" text,
	"verification_notes" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_incident_id_error_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."error_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_incident_notes" ADD CONSTRAINT "error_incident_notes_incident_id_error_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."error_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_events_incident_occurred_idx" ON "error_events" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "error_events_occurred_idx" ON "error_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "error_incident_notes_incident_created_idx" ON "error_incident_notes" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "error_incidents_fingerprint_unique" ON "error_incidents" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_incidents_status_seen_idx" ON "error_incidents" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "error_incidents_severity_seen_idx" ON "error_incidents" USING btree ("severity","last_seen_at");