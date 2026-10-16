CREATE TABLE "monthly_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialist_id" uuid NOT NULL,
	"project_id" uuid,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"source" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"goal_type" text NOT NULL,
	"target_process" text,
	"target_work_item_id" uuid,
	"target_date" date NOT NULL,
	"status" text DEFAULT 'ACTIVO' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"evidence" jsonb,
	"result_context" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"idempotency_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_goals_valid_period" CHECK ("monthly_goals"."period_month" between 1 and 12 and "monthly_goals"."period_year" between 2000 and 2200),
	CONSTRAINT "monthly_goals_valid_source" CHECK ("monthly_goals"."source" in ('JEFATURA','ESPECIALISTA')),
	CONSTRAINT "monthly_goals_valid_status" CHECK ("monthly_goals"."status" in ('ACTIVO','CUMPLIDO','NO_CUMPLIDO','CANCELADO')),
	CONSTRAINT "monthly_goals_valid_type" CHECK (("monthly_goals"."goal_type"='GENERAL' and "monthly_goals"."target_process" is null and "monthly_goals"."target_work_item_id" is null) or ("monthly_goals"."project_id" is not null and (("monthly_goals"."goal_type"='CIERRE_PROYECTO' and "monthly_goals"."target_process" is null and "monthly_goals"."target_work_item_id" is null) or ("monthly_goals"."goal_type"='ALCANZAR_PROCESO' and "monthly_goals"."target_process" is not null and "monthly_goals"."target_work_item_id" is null) or ("monthly_goals"."goal_type"='ALCANZAR_HITO' and "monthly_goals"."target_work_item_id" is not null and "monthly_goals"."target_process" is null)))),
	CONSTRAINT "monthly_goals_valid_cancellation" CHECK ("monthly_goals"."status"<>'CANCELADO' or ("monthly_goals"."cancelled_at" is not null and length(trim("monthly_goals"."cancel_reason"))>0)),
	CONSTRAINT "monthly_goals_valid_completion" CHECK ("monthly_goals"."status"<>'CUMPLIDO' or ("monthly_goals"."completed_at" is not null and "monthly_goals"."evidence" is not null))
);
--> statement-breakpoint
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_specialist_id_usuarios_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_created_by_user_id_usuarios_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_target_work_item_id_work_items_id_fk" FOREIGN KEY ("target_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_completed_by_user_id_usuarios_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monthly_goals_period_specialist_idx" ON "monthly_goals" USING btree ("period_year","period_month","specialist_id");--> statement-breakpoint
CREATE INDEX "monthly_goals_project_status_idx" ON "monthly_goals" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_goals_creator_retry_idx" ON "monthly_goals" USING btree ("created_by_user_id","idempotency_key");