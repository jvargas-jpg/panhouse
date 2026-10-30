ALTER TABLE "pagos" DROP CONSTRAINT "pagos_proyecto_id_proyectos_id_fk";--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "monto_contractual" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "moneda_contractual" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "solvencia_estado" text DEFAULT 'Pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "solvencia_por_id" uuid;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "solvencia_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "solvencia_motivo" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "gate_financiero_requerido" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "notas" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "origen" text DEFAULT 'INTERNAL_TEMPORARY' NOT NULL;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "external_payment_id" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "registrado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "confirmado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "confirmado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "anulado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "anulado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_solvencia_por_id_usuarios_id_fk" FOREIGN KEY ("solvencia_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_confirmado_por_id_usuarios_id_fk" FOREIGN KEY ("confirmado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_anulado_por_id_usuarios_id_fk" FOREIGN KEY ("anulado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pagos_proyecto_estado_fecha_idx" ON "pagos" USING btree ("proyecto_id","estatus","fecha_pago");--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_actor_idempotencia_unique" UNIQUE("registrado_por_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_origen_externo_unique" UNIQUE("origen","external_payment_id");
--> statement-breakpoint
UPDATE pagos SET origen='MIGRATED';
--> statement-breakpoint
ALTER TABLE pagos ADD CONSTRAINT pagos_monto_positivo CHECK (monto>0) NOT VALID;
--> statement-breakpoint
ALTER TABLE proyectos ADD CONSTRAINT proyectos_contrato_coherente CHECK ((monto_contractual IS NULL AND moneda_contractual IS NULL) OR (monto_contractual>0 AND moneda_contractual ~ '^[A-Z]{3}$'));
--> statement-breakpoint
ALTER TABLE proyectos ADD CONSTRAINT proyectos_solvencia_valida CHECK(solvencia_estado IN ('Pendiente','Solvente','No solvente'));
--> statement-breakpoint
CREATE FUNCTION proteger_historial_pagos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Los pagos no se eliminan; deben anularse'; END IF;
 IF (to_jsonb(NEW) - ARRAY['estatus','motivo_rechazo','confirmado_por_id','confirmado_en','anulado_por_id','anulado_en','motivo_anulacion','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['estatus','motivo_rechazo','confirmado_por_id','confirmado_en','anulado_por_id','anulado_en','motivo_anulacion','updated_at'])
 THEN RAISE EXCEPTION 'Los datos de un abono son inmutables'; END IF;
 IF OLD.estatus='Anulado' OR (OLD.estatus IN ('Verificado','Rechazado') AND NEW.estatus<>'Anulado')
 THEN RAISE EXCEPTION 'Transici?n de pago no permitida'; END IF;
 IF NEW.estatus='Anulado' AND (nullif(trim(NEW.motivo_anulacion),'') IS NULL OR NEW.anulado_en IS NULL OR NEW.anulado_por_id IS NULL)
 THEN RAISE EXCEPTION 'La anulaci?n requiere motivo, fecha y responsable'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER pagos_historial_inmutable BEFORE UPDATE OR DELETE ON pagos FOR EACH ROW EXECUTE FUNCTION proteger_historial_pagos();
