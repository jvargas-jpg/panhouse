ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_tripa_completa_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_tripa_completa_aprobado" boolean;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_preliminares_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_preliminares_aprobado" boolean;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_cubierta_extendida_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_cubierta_extendida_aprobado" boolean;