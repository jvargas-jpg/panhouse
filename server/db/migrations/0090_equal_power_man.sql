CREATE TABLE "correccion_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"tripa_drive_url" text NOT NULL,
	"tripa_drive_file_id" text,
	"report_drive_url" text NOT NULL,
	"report_drive_file_id" text,
	"observaciones" text,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correccion_blockers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution" text
);
--> statement-breakpoint
ALTER TABLE "correccion_deliveries" ADD CONSTRAINT "correccion_deliveries_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correccion_deliveries" ADD CONSTRAINT "correccion_deliveries_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correccion_deliveries" ADD CONSTRAINT "correccion_deliveries_submitted_by_usuarios_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correccion_blockers" ADD CONSTRAINT "correccion_blockers_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correccion_blockers" ADD CONSTRAINT "correccion_blockers_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correccion_blockers" ADD CONSTRAINT "correccion_blockers_resolved_by_usuarios_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "correccion_blockers_open_unique" ON "correccion_blockers" USING btree ("work_item_id") WHERE "correccion_blockers"."resolved_at" IS NULL;