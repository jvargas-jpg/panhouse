ALTER TABLE "fichas_trazabilidad" DROP COLUMN "condiciones_especiales";--> statement-breakpoint
DROP TYPE "public"."condicion_especial";--> statement-breakpoint
CREATE TYPE "public"."condicion_especial" AS ENUM('Ilustraciones', 'Gráficos', 'Diagramación especial', 'Diagramación ultra especial');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "condiciones_especiales" "condicion_especial"[];
