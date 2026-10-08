ALTER TABLE "ficha_calidad_fases" ADD COLUMN "work_item_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "diseno_version_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "solicitado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "iniciado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "revisado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "revisado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "comentarios_url" text;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "cantidad_comentarios" integer;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "observaciones" text;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "numeros_legales_url" text;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "checklist" jsonb;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_diseno_version_id_diseno_versiones_id_fk" FOREIGN KEY ("diseno_version_id") REFERENCES "public"."diseno_versiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_revisado_por_id_usuarios_id_fk" FOREIGN KEY ("revisado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_work_item_id_unique" UNIQUE("work_item_id");
--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD COLUMN "feedback_archivo_url" text;
--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ALTER CONSTRAINT "ficha_calidad_fases_diseno_version_id_diseno_versiones_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
-- Conecta exclusivamente handoffs ya registrados por 5D; no sintetiza
-- revisiones, responsables, resultados ni plazos de históricos legacy.
UPDATE "ficha_calidad_fases" AS q
SET "work_item_id" = v."calidad_work_item_id",
    "diseno_version_id" = v."id",
    "solicitado_en" = v."handoff_en"
FROM "diseno_versiones" AS v
WHERE v."calidad_fase_id" = q."id"
  AND v."calidad_work_item_id" IS NOT NULL
  AND q."work_item_id" IS NULL;
