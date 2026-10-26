CREATE TABLE "editorial_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"drive_url" text NOT NULL,
	"drive_file_id" text,
	"observaciones" text,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_blockers" (
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
ALTER TABLE "editorial_deliveries" ADD CONSTRAINT "editorial_deliveries_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_deliveries" ADD CONSTRAINT "editorial_deliveries_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_deliveries" ADD CONSTRAINT "editorial_deliveries_submitted_by_usuarios_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_blockers" ADD CONSTRAINT "editorial_blockers_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_blockers" ADD CONSTRAINT "editorial_blockers_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_blockers" ADD CONSTRAINT "editorial_blockers_resolved_by_usuarios_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_blockers_open_unique" ON "editorial_blockers" USING btree ("work_item_id") WHERE "editorial_blockers"."resolved_at" IS NULL;
--> statement-breakpoint
-- Tipos nuevos para solicitudes que el propio Editor envía sobre un work
-- item ya asignado -- nunca el tipo 'editor' existente, que significa
-- "el Especialista solicita que se asigne un Editor" (ver 0087).
ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion','creativa','editor','editor_apoyo','editor_reasignacion','editor_aclaracion'));