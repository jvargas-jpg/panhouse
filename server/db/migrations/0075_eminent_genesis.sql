ALTER TABLE "correcciones" ADD COLUMN "asignado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "correcciones" ADD COLUMN "iniciado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "iniciado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "correccion_id" uuid;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "calidad_fase_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_iniciado_por_id_usuarios_id_fk" FOREIGN KEY ("iniciado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_correccion_id_correcciones_id_fk" FOREIGN KEY ("correccion_id") REFERENCES "public"."correcciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_calidad_fase_id_ficha_calidad_fases_id_fk" FOREIGN KEY ("calidad_fase_id") REFERENCES "public"."ficha_calidad_fases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_correccion_id_unique" UNIQUE("correccion_id");--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_fases_calidad_fase_id_unique" UNIQUE("calidad_fase_id");--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD CONSTRAINT "seguimiento_origen_exclusivo" CHECK ("seguimiento_fases"."correccion_id" IS NULL OR "seguimiento_fases"."calidad_fase_id" IS NULL);