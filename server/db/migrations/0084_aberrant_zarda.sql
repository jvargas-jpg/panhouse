CREATE TABLE "project_workspace_requests" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"requested_by_user_id" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_workspace_request_status_valid" CHECK ("project_workspace_requests"."status" in ('PENDING','PROVISIONING','READY','ERROR'))
);
--> statement-breakpoint
ALTER TABLE "project_workspace_requests" ADD CONSTRAINT "project_workspace_requests_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workspace_requests" ADD CONSTRAINT "project_workspace_requests_requested_by_user_id_usuarios_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_workspace_request_status_idx" ON "project_workspace_requests" USING btree ("status");