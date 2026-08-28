ALTER TABLE "proyectos" ADD COLUMN "distribucion_id" uuid;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "distribucion_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "distribucion_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "distribucion_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "distribucion_total_dias" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "distribucion_observaciones" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_distribucion_id_usuarios_id_fk" FOREIGN KEY ("distribucion_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;