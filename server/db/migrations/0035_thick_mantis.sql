ALTER TABLE "autores" ALTER COLUMN "redes_sociales" SET DATA TYPE jsonb USING "redes_sociales"::jsonb;--> statement-breakpoint
ALTER TABLE "autores" ADD COLUMN "personalidad" text;--> statement-breakpoint
ALTER TABLE "autores" ADD COLUMN "ocupacion" text;