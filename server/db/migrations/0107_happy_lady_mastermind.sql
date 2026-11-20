CREATE TABLE "reunion_extraccion_solicitudes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reunion_id" uuid NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"solicitado_por" text NOT NULL,
	"solicitado_por_user_id" uuid NOT NULL,
	"fecha_hora_propuesta" timestamp with time zone NOT NULL,
	"duracion_propuesta_minutos" integer,
	"motivo" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"respondido_en" timestamp with time zone,
	"respondido_por_user_id" uuid,
	"respuesta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reuniones_extraccion" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "reuniones_extraccion" ADD COLUMN "notas_gemini_url" text;--> statement-breakpoint
ALTER TABLE "reunion_extraccion_solicitudes" ADD CONSTRAINT "reunion_extraccion_solicitudes_reunion_id_reuniones_extraccion_id_fk" FOREIGN KEY ("reunion_id") REFERENCES "public"."reuniones_extraccion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_extraccion_solicitudes" ADD CONSTRAINT "reunion_extraccion_solicitudes_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_extraccion_solicitudes" ADD CONSTRAINT "reunion_extraccion_solicitudes_solicitado_por_user_id_usuarios_id_fk" FOREIGN KEY ("solicitado_por_user_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_extraccion_solicitudes" ADD CONSTRAINT "reunion_extraccion_solicitudes_respondido_por_user_id_usuarios_id_fk" FOREIGN KEY ("respondido_por_user_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reunion_extraccion_solicitud_pendiente_unique" ON "reunion_extraccion_solicitudes" USING btree ("reunion_id") WHERE "reunion_extraccion_solicitudes"."estado"='pendiente';--> statement-breakpoint
CREATE INDEX "reunion_extraccion_solicitud_reunion_idx" ON "reunion_extraccion_solicitudes" USING btree ("reunion_id","created_at");