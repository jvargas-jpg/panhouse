ALTER TABLE "seguimiento_fases" ADD COLUMN "tiempo_correcto" text;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "especialista_id" uuid;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "tipo_servicio" text;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "freelance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "pago_80" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "pago_20" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "resultados_correccion" text;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "cantidad_comentarios" integer;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "cumplimiento" text;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_especialista_id_usuarios_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;