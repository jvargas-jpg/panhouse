CREATE TABLE "seguimiento_fases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"analista_id" uuid,
	"asignacion_tipo" text,
	"paginas" integer,
	"fecha_asignada" date,
	"hora_recibida" time,
	"fecha_inicio" date,
	"hora_inicio" time,
	"fecha_entrega" date,
	"hora_entrega" time,
	"estatus" text,
	"total_dias" numeric(6, 2),
	"total_horas" numeric(6, 2),
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_analista_id_usuarios_id_fk" FOREIGN KEY ("analista_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;