ALTER TABLE solicitudes_area ADD COLUMN asunto text;
--> statement-breakpoint
ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion','creativa','editor','editor_apoyo','editor_reasignacion','editor_aclaracion','corrector_material','corrector_aclaracion','corrector_tecnico','calidad_material','calidad_aclaracion','calidad_tecnico'));
--> statement-breakpoint
CREATE UNIQUE INDEX solicitudes_calidad_abierta_unique ON solicitudes_area(requested_by_id,work_item_id,tipo)
 WHERE tipo IN ('calidad_material','calidad_aclaracion','calidad_tecnico') AND estado IN ('pendiente','en_revision','requiere_informacion');
--> statement-breakpoint
CREATE INDEX solicitudes_calidad_requester_idx ON solicitudes_area(requested_by_id,requested_at DESC)
 WHERE tipo IN ('calidad_material','calidad_aclaracion','calidad_tecnico');
--> statement-breakpoint
CREATE UNIQUE INDEX solicitudes_calidad_envio_unique ON solicitudes_area(requested_by_id,business_key)
 WHERE tipo IN ('calidad_material','calidad_aclaracion','calidad_tecnico');
--> statement-breakpoint
CREATE FUNCTION validar_contexto_solicitud_calidad() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.tipo IN ('calidad_material','calidad_aclaracion','calidad_tecnico') THEN
  IF NEW.asunto IS NULL OR length(trim(NEW.asunto))<5 OR NEW.descripcion IS NULL OR length(trim(NEW.descripcion))<10
    OR NEW.target_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM ficha_calidad_fases q JOIN fichas_trazabilidad f ON f.id=q.ficha_id
      JOIN work_items w ON w.id=q.work_item_id
      WHERE q.work_item_id=NEW.work_item_id AND f.proyecto_id=NEW.proyecto_id
        AND w.proyecto_id=NEW.proyecto_id AND w.tipo='calidad' AND q.diseno_version_id IS NOT NULL
    ) THEN RAISE EXCEPTION 'Solicitud de Calidad sin contexto válido' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER solicitudes_calidad_contexto BEFORE INSERT OR UPDATE ON solicitudes_area
 FOR EACH ROW EXECUTE FUNCTION validar_contexto_solicitud_calidad();
