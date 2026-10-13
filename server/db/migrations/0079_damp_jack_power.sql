CREATE TABLE "contratos_correccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correccion_id" uuid NOT NULL,
	"ronda" integer NOT NULL,
	"corrector_nombre" text NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"motivo" text
);
--> statement-breakpoint
CREATE TABLE "informacion_contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"pregunta" text NOT NULL,
	"asked_by_id" uuid NOT NULL,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"respuesta" text,
	"answered_by_id" uuid,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contratos_correccion" ADD CONSTRAINT "contratos_correccion_correccion_id_correcciones_id_fk" FOREIGN KEY ("correccion_id") REFERENCES "public"."correcciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos_correccion" ADD CONSTRAINT "contratos_correccion_requested_by_id_usuarios_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos_correccion" ADD CONSTRAINT "contratos_correccion_resolved_by_id_usuarios_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informacion_contrato" ADD CONSTRAINT "informacion_contrato_contrato_id_contratos_correccion_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos_correccion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informacion_contrato" ADD CONSTRAINT "informacion_contrato_asked_by_id_usuarios_id_fk" FOREIGN KEY ("asked_by_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informacion_contrato" ADD CONSTRAINT "informacion_contrato_answered_by_id_usuarios_id_fk" FOREIGN KEY ("answered_by_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contrato_correccion_ronda_unique" ON "contratos_correccion" USING btree ("correccion_id","ronda");--> statement-breakpoint
CREATE UNIQUE INDEX "contrato_correccion_abierto_unique" ON "contratos_correccion" USING btree ("correccion_id") WHERE "contratos_correccion"."estado" in ('pendiente','en_revision','requiere_informacion');--> statement-breakpoint
CREATE INDEX "informacion_contrato_idx" ON "informacion_contrato" USING btree ("contrato_id");--> statement-breakpoint
CREATE UNIQUE INDEX "informacion_contrato_abierta_unique" ON "informacion_contrato" USING btree ("contrato_id") WHERE "informacion_contrato"."answered_at" is null;