ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_total_dias" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_observaciones" text;