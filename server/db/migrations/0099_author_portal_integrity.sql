ALTER TABLE usuarios DROP CONSTRAINT usuarios_account_type_valid;
--> statement-breakpoint
ALTER TABLE usuarios ADD CONSTRAINT usuarios_account_type_valid CHECK (account_type IN ('internal','external') AND (account_type <> 'external' OR rol::text IN ('corrector','autor')));
--> statement-breakpoint
ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK (tipo IN ('lanzamiento','impresion','creativa','editor','editor_apoyo','editor_reasignacion','editor_aclaracion','corrector_material','corrector_aclaracion','corrector_tecnico','calidad_material','calidad_aclaracion','calidad_tecnico','digital_material','digital_aclaracion','digital_tecnico','autor_pausa'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_author_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'An author decision is immutable' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','feedback','decided_at','recorded_by','external_evidence']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','feedback','decided_at','recorded_by','external_evidence']) THEN
   RAISE EXCEPTION 'Approval request identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER approval_decision_immutable BEFORE UPDATE ON approval_requests FOR EACH ROW EXECUTE FUNCTION protect_author_decision();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_author_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
   RAISE EXCEPTION 'Shared revision is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER author_document_immutable BEFORE UPDATE ON author_documents FOR EACH ROW EXECUTE FUNCTION protect_author_document();
