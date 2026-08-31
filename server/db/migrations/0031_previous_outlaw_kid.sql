ALTER TABLE "usuarios" ADD COLUMN "autor_id" uuid;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "manuscrito_url" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_autor_id_autores_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."autores"("id") ON DELETE set null ON UPDATE no action;