ALTER TABLE usuarios ADD COLUMN account_type text NOT NULL DEFAULT 'internal';
ALTER TABLE usuarios ADD CONSTRAINT usuarios_account_type_valid CHECK (account_type IN ('internal','external') AND (account_type<>'external' OR rol::text='corrector'));
ALTER TABLE sesiones ADD COLUMN public_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sesiones ADD CONSTRAINT sesiones_public_id_unique UNIQUE(public_id);
ALTER TABLE sesiones ADD COLUMN last_activity_at timestamptz;
ALTER TABLE sesiones ADD COLUMN ip text;
ALTER TABLE sesiones ADD COLUMN user_agent text;
ALTER TABLE sesiones ADD COLUMN revoked_at timestamptz;
ALTER TABLE sesiones ADD COLUMN revoked_by_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE sesiones ADD COLUMN revoke_reason text;
ALTER TABLE sesiones ADD COLUMN view_as_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX sesiones_user_expires_idx ON sesiones(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE admin_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL, action text NOT NULL, input_hash text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT admin_operations_retry_unique UNIQUE(actor_id,request_key)
);
CREATE TABLE security_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL,
 actor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL, target_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
 session_public_id uuid, ip text, user_agent text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_created_idx ON security_events(created_at DESC);
CREATE INDEX security_events_target_created_idx ON security_events(target_user_id,created_at DESC);
CREATE INDEX audit_logs_created_id_idx ON audit_logs(created_at DESC,id);
CREATE INDEX work_items_admin_deadline_idx ON work_items(fecha_fin_pautada,proyecto_id) WHERE estado IN ('pendiente','en_progreso','bloqueado');
CREATE INDEX work_items_admin_project_idx ON work_items(proyecto_id,tipo,estado);
CREATE INDEX project_assignments_admin_project_idx ON project_assignments(proyecto_id,tipo) WHERE finalizado_en IS NULL;
--> statement-breakpoint
-- SQL read model equivalent of edicionSla.ts; no new SLA values.
CREATE FUNCTION panhouse_add_business_days(day_value date, days_count integer) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result date:=day_value; remaining integer:=days_count;
BEGIN IF result IS NULL THEN RETURN NULL; END IF;
 WHILE remaining>0 LOOP result:=result+1; IF extract(isodow FROM result)<6 THEN remaining:=remaining-1; END IF; END LOOP;
 RETURN result; END $$;
--> statement-breakpoint
CREATE FUNCTION panhouse_editor_deadline(start_value date,due_value date,project_uuid uuid,today_value date) RETURNS date LANGUAGE plpgsql STABLE AS $$
DECLARE result date:=due_value; current_day date:=start_value+1;
BEGIN IF start_value IS NULL OR due_value IS NULL THEN RETURN due_value; END IF;
 WHILE current_day<=result LOOP
  IF current_day<=today_value AND extract(isodow FROM current_day)<6 AND EXISTS(SELECT 1 FROM pausas p WHERE p.proyecto_id=project_uuid
   AND current_day>=(p.fecha_inicio AT TIME ZONE 'America/Caracas')::date AND current_day<coalesce((p.fecha_fin AT TIME ZONE 'America/Caracas')::date,panhouse_add_business_days(today_value,1)))
  THEN result:=panhouse_add_business_days(result,1); END IF;
  current_day:=current_day+1;
 END LOOP; RETURN result; END $$;
