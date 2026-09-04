CREATE TABLE "proyectos_autores" (
	"proyecto_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	CONSTRAINT "proyectos_autores_proyecto_id_autor_id_pk" PRIMARY KEY("proyecto_id","autor_id")
);
--> statement-breakpoint
ALTER TABLE "proyectos_autores" ADD CONSTRAINT "proyectos_autores_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyectos_autores" ADD CONSTRAINT "proyectos_autores_autor_id_autores_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."autores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Backfill: cada proyecto existente ya tiene exactamente un autor en
-- proyectos.autor_id — esta migración solo agrega la tabla de unión,
-- todavía no la reemplaza, así que los datos ya existentes deben
-- reflejarse acá también.
INSERT INTO "proyectos_autores" ("proyecto_id", "autor_id") SELECT "id", "autor_id" FROM "proyectos";