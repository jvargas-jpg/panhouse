ALTER TABLE "proyectos" ADD COLUMN "codigo" text;--> statement-breakpoint
UPDATE "proyectos" SET "codigo" = upper(left(replace("id"::text, '-', ''), 6));--> statement-breakpoint
ALTER TABLE "proyectos" ALTER COLUMN "codigo" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_codigo_unique" UNIQUE("codigo");