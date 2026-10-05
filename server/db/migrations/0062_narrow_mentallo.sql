CREATE TYPE "public"."estado_work_item" AS ENUM('pendiente', 'en_progreso', 'bloqueado', 'completado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipo_asignacion" AS ENUM('especialista', 'jefe_area', 'editor', 'disenador', 'corrector', 'lider_creativo', 'validador');--> statement-breakpoint
CREATE TYPE "public"."tipo_work_item" AS ENUM('intake_rrpp', 'asignacion_especialista', 'edicion', 'correccion', 'diseno', 'calidad', 'soporte_digital', 'lanzamiento', 'impresion', 'distribucion');--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"tipo" "tipo_work_item" NOT NULL,
	"estado" "estado_work_item" DEFAULT 'pendiente' NOT NULL,
	"gate_bloqueante" text,
	"fecha_inicio_pautada" date,
	"fecha_fin_pautada" date,
	"fecha_inicio_real" date,
	"fecha_fin_real" date,
	"total_dias" numeric(6, 2),
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_items_proyecto_tipo_unique" UNIQUE("proyecto_id","tipo")
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"work_item_id" uuid,
	"tipo" "tipo_asignacion" NOT NULL,
	"usuario_id" uuid NOT NULL,
	"asignado_por_id" uuid,
	"asignado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizado_en" timestamp with time zone,
	"motivo_fin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"accion" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"proyecto_id" uuid,
	"detalles" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" DROP CONSTRAINT "ficha_calidad_fases_ficha_numero_unique";--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "ronda" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_asignado_por_id_usuarios_id_fk" FOREIGN KEY ("asignado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_usuarios_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_assignments_activa_proyecto_unique" ON "project_assignments" USING btree ("proyecto_id","tipo") WHERE "project_assignments"."work_item_id" IS NULL AND "project_assignments"."finalizado_en" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_assignments_activa_work_item_unique" ON "project_assignments" USING btree ("work_item_id","tipo") WHERE "project_assignments"."work_item_id" IS NOT NULL AND "project_assignments"."finalizado_en" IS NULL;--> statement-breakpoint
CREATE INDEX "project_assignments_usuario_idx" ON "project_assignments" USING btree ("usuario_id","finalizado_en");--> statement-breakpoint
CREATE INDEX "project_assignments_proyecto_idx" ON "project_assignments" USING btree ("proyecto_id");--> statement-breakpoint
CREATE INDEX "audit_logs_proyecto_created_idx" ON "audit_logs" USING btree ("proyecto_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_ficha_numero_ronda_unique" UNIQUE("ficha_id","numero_fase","ronda");--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_ronda_valida" CHECK ("ficha_calidad_fases"."ronda" >= 1);