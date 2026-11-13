CREATE TABLE "validation_delivery_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_delivery_outbox_phase_id_unique" UNIQUE("phase_id")
);
--> statement-breakpoint
ALTER TABLE "diseno_versiones" ALTER COLUMN "entregado_por_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "validator_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "validator_requested_by_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "comments_upload" jsonb;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "decision_key" uuid;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD COLUMN "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD COLUMN "drive_revision_id" text;--> statement-breakpoint
ALTER TABLE "disenos" ADD COLUMN "external_provider_name" text;--> statement-breakpoint
ALTER TABLE "disenos" ADD COLUMN "external_provider_email" text;--> statement-breakpoint
ALTER TABLE "validation_delivery_outbox" ADD CONSTRAINT "validation_delivery_outbox_phase_id_ficha_calidad_fases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."ficha_calidad_fases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_validator_requested_by_id_usuarios_id_fk" FOREIGN KEY ("validator_requested_by_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_drive_file_id_unique" UNIQUE("drive_file_id");
--> statement-breakpoint
-- Preserve people and historical references; external providers have no login.
UPDATE usuarios SET activo=false,updated_at=now() WHERE rol IN ('disenador','corrector');
--> statement-breakpoint
UPDATE sesiones SET revoked_at=now(),revoke_reason='Servicio externo: acceso operativo retirado' WHERE user_id IN (SELECT id FROM usuarios WHERE rol IN ('disenador','corrector')) AND revoked_at IS NULL;

--> statement-breakpoint
-- Adopt known historical providers without inventing people or assignments.
UPDATE disenos d SET external_provider_name=u.nombre,external_provider_email=lower(u.email)
FROM proyectos p JOIN usuarios u ON u.id=p.disenador_id
WHERE d.proyecto_id=p.id AND d.external_provider_email IS NULL;
