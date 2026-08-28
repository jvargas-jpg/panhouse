ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_total_dias" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_observaciones" text;