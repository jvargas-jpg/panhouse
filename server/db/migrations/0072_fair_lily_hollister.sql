ALTER TYPE "public"."rol" ADD VALUE 'distribucion' BEFORE 'cobranzas';--> statement-breakpoint
ALTER TYPE "public"."tipo_asignacion" ADD VALUE 'rrpp';--> statement-breakpoint
CREATE TABLE "rrpp_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"client_key" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'No iniciada' NOT NULL,
	"fase" text,
	"fecha" date NOT NULL,
	"hora" time,
	"lugar" text,
	"responsable_id" uuid,
	"representante_id" uuid,
	"ruta_actividad" text,
	"notas_rrss" text,
	"programas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrpp_eventos_proyecto_client_unique" UNIQUE("proyecto_id","client_key")
);
--> statement-breakpoint
CREATE TABLE "rrpp_publicaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"client_key" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'Nuevo' NOT NULL,
	"estado_pieza" text,
	"detalles" text,
	"notas" text,
	"responsable_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrpp_publicaciones_proyecto_client_unique" UNIQUE("proyecto_id","client_key")
);
--> statement-breakpoint
ALTER TABLE "ficha_lanzamiento_reuniones" ADD COLUMN "realizada" boolean;--> statement-breakpoint
ALTER TABLE "ficha_lanzamiento_reuniones" ADD COLUMN "responsable_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_lanzamiento_reuniones" ADD COLUMN "client_key" uuid;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_primera_realizada" boolean;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_primera_responsable_id" uuid;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_segunda_realizada" boolean;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_segunda_responsable_id" uuid;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_venta_cruzada" text[];--> statement-breakpoint
ALTER TABLE "rrpp_eventos" ADD CONSTRAINT "rrpp_eventos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrpp_eventos" ADD CONSTRAINT "rrpp_eventos_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrpp_eventos" ADD CONSTRAINT "rrpp_eventos_representante_id_usuarios_id_fk" FOREIGN KEY ("representante_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrpp_publicaciones" ADD CONSTRAINT "rrpp_publicaciones_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrpp_publicaciones" ADD CONSTRAINT "rrpp_publicaciones_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rrpp_eventos_fecha_idx" ON "rrpp_eventos" USING btree ("fecha","proyecto_id");--> statement-breakpoint
CREATE INDEX "rrpp_eventos_proyecto_idx" ON "rrpp_eventos" USING btree ("proyecto_id");--> statement-breakpoint
CREATE INDEX "rrpp_publicaciones_estado_idx" ON "rrpp_publicaciones" USING btree ("estado","proyecto_id");--> statement-breakpoint
CREATE INDEX "rrpp_publicaciones_proyecto_idx" ON "rrpp_publicaciones" USING btree ("proyecto_id");--> statement-breakpoint
ALTER TABLE "ficha_lanzamiento_reuniones" ADD CONSTRAINT "ficha_lanzamiento_reuniones_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD CONSTRAINT "fichas_trazabilidad_lanzamiento_promocion_primera_responsable_id_usuarios_id_fk" FOREIGN KEY ("lanzamiento_promocion_primera_responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD CONSTRAINT "fichas_trazabilidad_lanzamiento_promocion_segunda_responsable_id_usuarios_id_fk" FOREIGN KEY ("lanzamiento_promocion_segunda_responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_lanzamiento_reuniones" ADD CONSTRAINT "ficha_lanzamiento_reuniones_client_key_unique" UNIQUE("client_key");
--> statement-breakpoint
-- Las dos hojas describen las mismas reuniones de PyL. La Ficha es canónica;
-- los valores antiguos se conservan sin DROP ni sobrescribir conflictos.
UPDATE fichas_trazabilidad SET
  lanzamiento_promocion_fecha_primera_reunion = coalesce(lanzamiento_promocion_fecha_primera_reunion, asesoria_fecha_primera_reunion),
  lanzamiento_promocion_fecha_segunda_reunion = coalesce(lanzamiento_promocion_fecha_segunda_reunion, asesoria_fecha_segunda_reunion);
--> statement-breakpoint
-- Hitos anteriores al despliegue y planes históricos. No se crean fechas,
-- responsables ni estados de realización para registros antiguos.
WITH candidatos AS (
  SELECT p.id, p.codigo,
    CASE WHEN s.codigo = 'SE' AND p.disenador_id IS NOT NULL THEN 'asignacion_diseno'
      WHEN s.codigo = 'CR' AND f.ingreso_servicio_subtipo_crudo = 'Tripa'
        AND (f.edicion_fecha_envio_autor IS NOT NULL OR p.fecha_feedback_tripa IS NOT NULL) THEN 'feedback_tripa_completa'
      WHEN (s.codigo = 'EF' OR (s.codigo = 'CR' AND f.ingreso_servicio_subtipo_crudo = 'Capítulo'))
        AND EXISTS (SELECT 1 FROM capitulos c WHERE c.proyecto_id = p.id AND c.numero = 4 AND c.fecha_envio_autor IS NOT NULL) THEN 'feedback_capitulo_4'
      ELSE 'plan_historico' END AS hito,
    f.asesoria_fase
  FROM proyectos p JOIN servicios s ON s.id = p.servicio_id LEFT JOIN fichas_trazabilidad f ON f.proyecto_id = p.id
  WHERE (s.codigo = 'SE' AND p.disenador_id IS NOT NULL)
    OR (s.codigo = 'CR' AND f.ingreso_servicio_subtipo_crudo = 'Tripa' AND (f.edicion_fecha_envio_autor IS NOT NULL OR p.fecha_feedback_tripa IS NOT NULL))
    OR ((s.codigo = 'EF' OR (s.codigo = 'CR' AND f.ingreso_servicio_subtipo_crudo = 'Capítulo')) AND EXISTS (SELECT 1 FROM capitulos c WHERE c.proyecto_id = p.id AND c.numero = 4 AND c.fecha_envio_autor IS NOT NULL))
    OR f.asesoria_fase IS NOT NULL OR f.lanzamiento_promocion_fecha_primera_reunion IS NOT NULL
    OR f.lanzamiento_promocion_fecha_tentativa IS NOT NULL OR f.asesoria_fecha_pautada_autor IS NOT NULL
    OR f.asesoria_link_ruta_promocion IS NOT NULL
), creados AS (
  INSERT INTO work_items (proyecto_id, tipo, business_key, estado)
  SELECT id, 'lanzamiento', 'planificacion', CASE WHEN asesoria_fase = 'Culminado' THEN 'completado'::estado_work_item ELSE 'pendiente'::estado_work_item END
  FROM candidatos ON CONFLICT DO NOTHING RETURNING id, proyecto_id
), auditoria AS (
  INSERT INTO audit_logs (actor_id, accion, entity_type, entity_id, proyecto_id, detalles)
  SELECT NULL, 'PLANIFICACION_RRPP_CREADA', 'work_item', w.id, w.proyecto_id,
    jsonb_build_object('hito', c.hito, 'origen', 'migracion_0072')
  FROM creados w JOIN candidatos c ON c.id = w.proyecto_id
)
INSERT INTO notificaciones (proyecto_id, rol_destino, mensaje)
SELECT w.proyecto_id, 'rrpp', 'Planificación RRPP disponible para el proyecto #' || c.codigo || '.'
FROM creados w JOIN candidatos c ON c.id = w.proyecto_id WHERE c.asesoria_fase IS DISTINCT FROM 'Culminado';
