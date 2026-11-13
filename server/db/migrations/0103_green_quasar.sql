CREATE TABLE "reuniones_extraccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"fecha" date,
	"realizada" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reuniones_extraccion_proyecto_numero_unique" UNIQUE("proyecto_id","numero")
);
--> statement-breakpoint
ALTER TABLE "preparaciones_proyecto" ADD COLUMN "estructura_preliminares_url" text;--> statement-breakpoint
ALTER TABLE "preparaciones_proyecto" ADD COLUMN "solicitud_informacion_autor_url" text;--> statement-breakpoint
ALTER TABLE "preparaciones_proyecto" ADD COLUMN "extraccion_enlaces" jsonb;--> statement-breakpoint
ALTER TABLE "reuniones_extraccion" ADD CONSTRAINT "reuniones_extraccion_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;