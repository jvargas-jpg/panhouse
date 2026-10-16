CREATE TABLE "project_drive_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"parent_folder_key" text,
	"drive_folder_id" text NOT NULL,
	"drive_url" text,
	"display_name" text NOT NULL,
	"template_path" text NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "project_drive_folders_drive_folder_id_unique" UNIQUE("drive_folder_id"),
	CONSTRAINT "project_drive_folder_key_unique" UNIQUE("workspace_id","key"),
	CONSTRAINT "project_drive_folder_status_valid" CHECK ("project_drive_folders"."status" in ('PLANNED','READY'))
);
--> statement-breakpoint
CREATE TABLE "project_drive_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"storage_context_id" uuid NOT NULL,
	"projects_root_folder_id" text NOT NULL,
	"root_folder_id" text,
	"root_folder_url" text,
	"template_key" text NOT NULL,
	"template_version" text NOT NULL,
	"plan" jsonb NOT NULL,
	"status" text NOT NULL,
	"last_error_code" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sharing_status" text DEFAULT 'PENDING_VALIDATION' NOT NULL,
	"permission_id" text,
	"shared_with_user_id" uuid,
	"shared_with_email" text,
	"shared_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_drive_workspaces_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "project_drive_workspace_status_valid" CHECK ("project_drive_workspaces"."status" in ('PROVISIONING','READY','ERROR')),
	CONSTRAINT "project_drive_workspace_ready_valid" CHECK ("project_drive_workspaces"."status"<>'READY' or ("project_drive_workspaces"."root_folder_id" is not null and "project_drive_workspaces"."root_folder_url" is not null and "project_drive_workspaces"."ready_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "external_integrations" ADD COLUMN "storage_context_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "external_integrations" ADD COLUMN "projects_root_folder_id" text;--> statement-breakpoint
ALTER TABLE "external_integrations" ADD COLUMN "projects_root_folder_url" text;--> statement-breakpoint
ALTER TABLE "external_integrations" ADD COLUMN "projects_root_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "external_integrations" ADD COLUMN "workspace_sharing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "external_integrations" ADD COLUMN "workspace_sharing_tested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_drive_folders" ADD CONSTRAINT "project_drive_folders_workspace_id_project_drive_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."project_drive_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_drive_workspaces" ADD CONSTRAINT "project_drive_workspaces_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_drive_workspaces" ADD CONSTRAINT "project_drive_workspaces_integration_id_external_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."external_integrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_drive_workspaces" ADD CONSTRAINT "project_drive_workspaces_shared_with_user_id_usuarios_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_drive_workspaces" ADD CONSTRAINT "project_drive_workspaces_created_by_user_id_usuarios_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_drive_workspace_integration_idx" ON "project_drive_workspaces" USING btree ("integration_id");