CREATE TABLE "ficha_correccion_indicadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ficha_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"indicador" text NOT NULL,
	"aplica" boolean DEFAULT false,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "corrector_id" uuid;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "disenador_id" uuid;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_fin_proyectada" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_proceso_ingreso" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_extraccion_contenido" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_creacion_contenido" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_feedback_tripa" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_asignacion_correccion" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_asignacion_diseno" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_tripa_diagramada" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "fecha_aprobacion_final" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "contrato_firmado" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "pago_cuota_1" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "pago_cuota_2" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "pago_cuota_3" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "pago_cuota_4" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "pago_cuota_5" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "pago_cuota_6" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ficha_correccion_indicadores" ADD CONSTRAINT "ficha_correccion_indicadores_ficha_id_fichas_trazabilidad_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_trazabilidad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_corrector_id_usuarios_id_fk" FOREIGN KEY ("corrector_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_disenador_id_usuarios_id_fk" FOREIGN KEY ("disenador_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;