CREATE TABLE "direcciones_creativas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"tipo" text DEFAULT 'concepto_portada' NOT NULL,
	"fecha_solicitud" date,
	"fecha_reunion" date,
	"reunion_realizada" boolean DEFAULT false NOT NULL,
	"enlace_grabacion" text,
	"brief_enlace" text,
	"fecha_brief_enviado_especialista" date,
	"fecha_brief_enviado_autor" date,
	"fecha_brief_aprobado_autor" date,
	"recurso_imagen_url" text,
	"recurso_concepto_pdf_url" text,
	"resultado_final" text,
	"fecha_cierre" date,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "direccion_creativa_id" uuid;--> statement-breakpoint
ALTER TABLE "direcciones_creativas" ADD CONSTRAINT "direcciones_creativas_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direcciones_creativas" ADD CONSTRAINT "direcciones_creativas_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD CONSTRAINT "ficha_diseno_propuestas_direccion_creativa_id_direcciones_creativas_id_fk" FOREIGN KEY ("direccion_creativa_id") REFERENCES "public"."direcciones_creativas"("id") ON DELETE cascade ON UPDATE no action;