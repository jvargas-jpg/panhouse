CREATE TYPE "public"."estado_cotizacion_impresion" AS ENUM('solicitada', 'enviada', 'aceptada', 'rechazada');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_desea_cotizacion" boolean;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_responsable" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_estado_cotizacion" "estado_cotizacion_impresion";