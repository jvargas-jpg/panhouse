ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_tipo_asignacion" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_fecha_envio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_total_dias" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_observaciones" text;