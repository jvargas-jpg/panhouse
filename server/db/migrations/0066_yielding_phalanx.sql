ALTER TYPE "public"."rol" ADD VALUE 'corrector' BEFORE 'soporte_editorial';--> statement-breakpoint
CREATE TABLE "correcciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"alcance" text NOT NULL,
	"paginas" integer,
	"requiere_revision_previa" boolean DEFAULT false NOT NULL,
	"revision_previa_confirmada" boolean DEFAULT false NOT NULL,
	"corrector_id" uuid,
	"corrector_nombre" text,
	"freelance" boolean,
	"contrato_confirmado" boolean DEFAULT false NOT NULL,
	"fecha_asignada" date,
	"due_at" date,
	"fecha_inicio" date,
	"fecha_entrega" date,
	"control_cambios_url" text,
	"informe_tecnico_url" text,
	"resultado" text,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "correcciones" ADD CONSTRAINT "correcciones_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcciones" ADD CONSTRAINT "correcciones_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcciones" ADD CONSTRAINT "correcciones_corrector_id_usuarios_id_fk" FOREIGN KEY ("corrector_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;