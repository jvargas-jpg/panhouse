ALTER TABLE "proyectos" ADD COLUMN "express_decision" varchar(20);--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "express_fecha_estandar" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "express_fecha_deseada" date;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "express_decidido_por_id" uuid;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "express_decidido_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "express_motivo" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_express_decidido_por_id_usuarios_id_fk" FOREIGN KEY ("express_decidido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;