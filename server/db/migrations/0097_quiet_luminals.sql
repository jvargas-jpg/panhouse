CREATE TABLE "approval_artifacts" (
	"approval_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "approval_artifacts_approval_id_document_id_pk" PRIMARY KEY("approval_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"origin_id" uuid NOT NULL,
	"origin_work_item_id" uuid NOT NULL,
	"wait_work_item_id" uuid NOT NULL,
	"previous_id" uuid,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"feedback" text,
	"decided_at" timestamp with time zone,
	"recorded_by" uuid,
	"external_evidence" jsonb,
	CONSTRAINT "approval_requests_decision_check" CHECK (("approval_requests"."status"='pending' AND "approval_requests"."decided_at" IS NULL AND "approval_requests"."recorded_by" IS NULL) OR ("approval_requests"."status" IN ('approved','changes_requested') AND "approval_requests"."decided_at" IS NOT NULL AND "approval_requests"."recorded_by" IS NOT NULL AND ("approval_requests"."status"<>'changes_requested' OR length(trim("approval_requests"."feedback"))>0)))
);
--> statement-breakpoint
CREATE TABLE "author_credential_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "author_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"version" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"category" text DEFAULT 'compartido' NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "author_mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"path" text NOT NULL,
	"sent_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_mail_outbox_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "solicitudes_area" DROP CONSTRAINT "solicitudes_area_conversion_valid";--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD COLUMN "desired_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD COLUMN "expected_return" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD COLUMN "pausa_id" uuid;--> statement-breakpoint
ALTER TABLE "approval_artifacts" ADD CONSTRAINT "approval_artifacts_approval_id_approval_requests_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_artifacts" ADD CONSTRAINT "approval_artifacts_document_id_author_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."author_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_author_id_autores_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."autores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_origin_work_item_id_work_items_id_fk" FOREIGN KEY ("origin_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_wait_work_item_id_work_items_id_fk" FOREIGN KEY ("wait_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_usuarios_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_recorded_by_usuarios_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_credential_tokens" ADD CONSTRAINT "author_credential_tokens_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_documents" ADD CONSTRAINT "author_documents_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_documents" ADD CONSTRAINT "author_documents_author_id_autores_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."autores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_documents" ADD CONSTRAINT "author_documents_shared_by_usuarios_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_mail_outbox" ADD CONSTRAINT "author_mail_outbox_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_mail_outbox" ADD CONSTRAINT "author_mail_outbox_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_author_idx" ON "approval_requests" USING btree ("author_id","status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_active_unique" ON "approval_requests" USING btree ("project_id","author_id","type","origin_id") WHERE "approval_requests"."status"='pending';--> statement-breakpoint
CREATE INDEX "author_documents_owner_idx" ON "author_documents" USING btree ("author_id","project_id");--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_pausa_id_pausas_id_fk" FOREIGN KEY ("pausa_id") REFERENCES "public"."pausas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_conversion_valid" CHECK (("solicitudes_area"."tipo" IN ('creativa','autor_pausa') or ("solicitudes_area"."work_item_id" is not null and "solicitudes_area"."requested_by_id" is not null)) and ("solicitudes_area"."tipo"<>'creativa' or "solicitudes_area"."estado"<>'resuelta' or "solicitudes_area"."work_item_id" is not null));