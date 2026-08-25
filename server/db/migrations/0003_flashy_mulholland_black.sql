CREATE TABLE "capitulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"fecha_envio_autor" date,
	"fecha_pautada_feedback" date,
	"fecha_respuesta_real" date,
	"enlaces" jsonb,
	"fecha_inicio_editor" date,
	"paginas" integer,
	"fecha_entrega_editor" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capitulos_proyecto_numero_unique" UNIQUE("proyecto_id","numero")
);
--> statement-breakpoint
ALTER TABLE "autores" ADD COLUMN "pais" text;--> statement-breakpoint
ALTER TABLE "capitulos" ADD CONSTRAINT "capitulos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" DROP COLUMN "data";