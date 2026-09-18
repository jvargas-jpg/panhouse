CREATE TYPE "public"."subtipo_crudo" AS ENUM('Capítulo', 'Tripa');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "ingreso_servicio_subtipo_crudo" "subtipo_crudo";