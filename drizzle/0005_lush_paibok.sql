CREATE TABLE "multipart_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"key" text NOT NULL,
	"upload_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"part_size" integer NOT NULL,
	"part_count" integer NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "multipart_uploads" ADD CONSTRAINT "multipart_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multipart_uploads" ADD CONSTRAINT "multipart_uploads_session_id_build_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."build_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "multipart_uploads_key_unique" ON "multipart_uploads" USING btree ("key");--> statement-breakpoint
CREATE INDEX "multipart_uploads_user_idx" ON "multipart_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "multipart_uploads_session_idx" ON "multipart_uploads" USING btree ("session_id");