CREATE TABLE "informacion_solicitud_area" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"pregunta" text NOT NULL,
	"asked_by_id" uuid NOT NULL,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"respuesta" text,
	"answered_by_id" uuid,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preparaciones_proyecto" (
	"proyecto_id" uuid PRIMARY KEY NOT NULL,
	"recibido_en" timestamp with time zone,
	"expediente_revisado_en" timestamp with time zone,
	"primer_contacto_en" timestamp with time zone,
	"reunion_operativa_fecha" timestamp with time zone,
	"reunion_operativa_realizada" boolean DEFAULT false NOT NULL,
	"grabacion_url" text,
	"transcripcion_url" text,
	"minuta_url" text,
	"cronograma_url" text,
	"drive_carpeta_url" text,
	"observaciones" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitudes_area" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"business_key" text NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"outcome" text,
	"motivo" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "solicitudes_area_instancia_unique" UNIQUE("proyecto_id","tipo","business_key")
);
--> statement-breakpoint
ALTER TABLE "informacion_solicitud_area" ADD CONSTRAINT "informacion_solicitud_area_solicitud_id_solicitudes_area_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informacion_solicitud_area" ADD CONSTRAINT "informacion_solicitud_area_asked_by_id_usuarios_id_fk" FOREIGN KEY ("asked_by_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informacion_solicitud_area" ADD CONSTRAINT "informacion_solicitud_area_answered_by_id_usuarios_id_fk" FOREIGN KEY ("answered_by_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparaciones_proyecto" ADD CONSTRAINT "preparaciones_proyecto_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_requested_by_id_usuarios_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_resolved_by_id_usuarios_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "informacion_solicitud_area_idx" ON "informacion_solicitud_area" USING btree ("solicitud_id","asked_at");--> statement-breakpoint
CREATE INDEX "solicitudes_area_estado_idx" ON "solicitudes_area" USING btree ("estado","tipo");
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion'));
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_estado_check CHECK(estado IN ('pendiente','en_revision','requiere_informacion','resuelta','rechazada','cancelada'));
--> statement-breakpoint
INSERT INTO work_items (proyecto_id,tipo,business_key,estado,fecha_inicio_pautada)
SELECT p.id,'preparacion_inicial','default','pendiente',a.asignado_en::date
FROM proyectos p LEFT JOIN project_assignments a ON a.proyecto_id=p.id AND a.tipo='especialista' AND a.work_item_id IS NULL AND a.finalizado_en IS NULL
WHERE a.usuario_id IS NOT NULL OR (p.especialista_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_assignments h WHERE h.proyecto_id=p.id AND h.tipo='especialista' AND h.work_item_id IS NULL))
ON CONFLICT(proyecto_id,tipo,business_key) DO NOTHING;
