CREATE TYPE "public"."estado_reunion" AS ENUM('Reunión de ingreso', 'Revisión de objetivos', 'Reunión creativa', 'Reunión de promoción, lanzamiento y distribución');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_ciudad_residencia" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_estado_reunion" "estado_reunion";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_propietario" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_contrato_firmado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_bienvenida_generada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_link_resumen" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_diagnostico_generado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_link_diagnostico" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_ingreso_generado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_fecha_reunion_creativa" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_venta_cruzada" text[];--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "matriz_observaciones_comerciales" text;