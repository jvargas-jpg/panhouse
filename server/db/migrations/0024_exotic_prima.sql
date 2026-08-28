ALTER TABLE "proyectos" ADD COLUMN "lanzamiento_id" uuid;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_total_dias" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_observaciones" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_lanzamiento_id_usuarios_id_fk" FOREIGN KEY ("lanzamiento_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;