CREATE TABLE "external_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"encrypted_refresh_token" text,
	"account_email" text,
	"account_id" text,
	"oauth_client_id" text,
	"scope" text[] DEFAULT '{}'::text[] NOT NULL,
	"connected_at" timestamp with time zone,
	"connected_by_user_id" uuid,
	"last_validated_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"last_error_code" text,
	"last_test_at" timestamp with time zone,
	"last_test_result" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_integrations_provider_unique" UNIQUE("provider"),
	CONSTRAINT "external_integrations_provider_valid" CHECK ("external_integrations"."provider"='google_drive'),
	CONSTRAINT "external_integrations_status_valid" CHECK ("external_integrations"."status" in ('connected','disconnected','error')),
	CONSTRAINT "external_integrations_usable_token" CHECK ("external_integrations"."status"<>'connected' or "external_integrations"."encrypted_refresh_token" is not null)
);
--> statement-breakpoint
CREATE TABLE "google_oauth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"session_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_code_verifier" text NOT NULL,
	"integration_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "google_oauth_attempts_state_hash_unique" UNIQUE("state_hash")
);
--> statement-breakpoint
ALTER TABLE "external_integrations" ADD CONSTRAINT "external_integrations_connected_by_user_id_usuarios_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_attempts" ADD CONSTRAINT "google_oauth_attempts_session_hash_sesiones_id_fk" FOREIGN KEY ("session_hash") REFERENCES "public"."sesiones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_oauth_attempts" ADD CONSTRAINT "google_oauth_attempts_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_oauth_attempts_user_created_idx" ON "google_oauth_attempts" USING btree ("user_id","created_at");