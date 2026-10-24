CREATE TABLE "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_tokens_email_created_idx" ON "login_tokens" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_tokens_expires_idx" ON "login_tokens" USING btree ("expires_at");