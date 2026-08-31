CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid,
	"rol_destino" text NOT NULL,
	"mensaje" text NOT NULL,
	"leido" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;