CREATE TABLE "media_derivative_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"status" "render_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "thumbnail_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "waveform_key" text;--> statement-breakpoint
ALTER TABLE "media_derivative_jobs" ADD CONSTRAINT "media_derivative_jobs_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_derivative_jobs_media_idx" ON "media_derivative_jobs" USING btree ("media_asset_id","created_at");--> statement-breakpoint
CREATE INDEX "media_derivative_jobs_status_idx" ON "media_derivative_jobs" USING btree ("status","created_at");