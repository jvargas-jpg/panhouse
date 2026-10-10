CREATE TABLE "ficha_documental_datos" (
	"proyecto_id" uuid NOT NULL,
	"seccion" text NOT NULL,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ficha_documental_datos_proyecto_id_seccion_pk" PRIMARY KEY("proyecto_id","seccion")
);
--> statement-breakpoint
ALTER TABLE "ficha_documental_datos" ADD CONSTRAINT "ficha_documental_datos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;