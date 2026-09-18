CREATE TYPE "public"."condicion_especial" AS ENUM('Ninguna', 'Ilustraciones', 'Gráficos', 'Diagramación especial', 'Diagramación ultra especial');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "capitulos_pactados" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "paginas_pactadas" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "criterio_extra" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "condiciones_especiales" "condicion_especial";