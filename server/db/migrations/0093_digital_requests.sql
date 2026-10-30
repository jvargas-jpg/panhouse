ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion','creativa','editor','editor_apoyo','editor_reasignacion','editor_aclaracion','corrector_material','corrector_aclaracion','corrector_tecnico','calidad_material','calidad_aclaracion','calidad_tecnico','digital_material','digital_aclaracion','digital_tecnico'));
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD COLUMN blocker_id uuid REFERENCES editorial_blockers(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX solicitudes_digital_abierta_unique ON solicitudes_area(requested_by_id,work_item_id,tipo) WHERE tipo IN ('digital_material','digital_aclaracion','digital_tecnico') AND estado IN ('pendiente','en_revision','requiere_informacion');
--> statement-breakpoint
CREATE UNIQUE INDEX solicitudes_digital_envio_unique ON solicitudes_area(requested_by_id,business_key) WHERE tipo IN ('digital_material','digital_aclaracion','digital_tecnico');
--> statement-breakpoint
CREATE INDEX solicitudes_digital_requester_idx ON solicitudes_area(requested_by_id,requested_at DESC) WHERE tipo IN ('digital_material','digital_aclaracion','digital_tecnico');
--> statement-breakpoint
CREATE FUNCTION validar_contexto_solicitud_digital() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.tipo IN ('digital_material','digital_aclaracion','digital_tecnico') THEN
  IF NEW.requested_by_id IS NULL OR NEW.target_user_id IS NULL OR NEW.requested_by_id=NEW.target_user_id
   OR NEW.asunto IS NULL OR length(trim(NEW.asunto))<5 OR NEW.descripcion IS NULL OR length(trim(NEW.descripcion))<10
   OR NOT EXISTS(SELECT 1 FROM work_items w WHERE w.id=NEW.work_item_id AND w.proyecto_id=NEW.proyecto_id AND w.tipo='soporte_digital')
   OR (NEW.blocker_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM editorial_blockers b WHERE b.id=NEW.blocker_id AND b.work_item_id=NEW.work_item_id AND b.created_by=NEW.requested_by_id))
   THEN RAISE EXCEPTION 'Solicitud digital sin contexto válido' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER solicitudes_digital_contexto BEFORE INSERT OR UPDATE ON solicitudes_area FOR EACH ROW EXECUTE FUNCTION validar_contexto_solicitud_digital();
--> statement-breakpoint
CREATE TABLE solicitud_archivos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), solicitud_id uuid NOT NULL REFERENCES solicitudes_area(id) ON DELETE CASCADE,
 uploaded_by_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT, name text NOT NULL, mime_type text NOT NULL, size integer NOT NULL,
 content bytea NOT NULL, sha256 text NOT NULL, upload_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT solicitud_archivos_upload_unique UNIQUE(solicitud_id,upload_key),
 CONSTRAINT solicitud_archivos_size_check CHECK(size>0 AND size<=5242880 AND octet_length(content)=size)
);
--> statement-breakpoint
CREATE INDEX solicitud_archivos_request_idx ON solicitud_archivos(solicitud_id,created_at);
