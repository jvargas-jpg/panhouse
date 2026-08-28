ALTER TABLE "proyectos" ADD COLUMN "digital_id" uuid;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "digital_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "digital_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "digital_fecha_entrega" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "digital_total_dias" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "digital_observaciones" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_digital_id_usuarios_id_fk" FOREIGN KEY ("digital_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;