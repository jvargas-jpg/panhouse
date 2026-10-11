CREATE TABLE "decisiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"origin_work_item_id" uuid,
	"origin_correccion_id" uuid,
	"origin_calidad_fase_id" uuid,
	"target_role" text DEFAULT 'jefe_area' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"assigned_decision_maker_id" uuid,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"resolution_type" text,
	"subject" text NOT NULL,
	"request_message" text,
	"resolution_message" text,
	"requested_info_message" text,
	"requested_info_at" timestamp with time zone,
	"requested_info_by_id" uuid,
	"responded_info_message" text,
	"responded_info_at" timestamp with time zone,
	"context_snapshot" jsonb,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_started_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"reabierta_desde_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisiones_origin_correccion_id_unique" UNIQUE("origin_correccion_id"),
	CONSTRAINT "decisiones_origin_calidad_fase_id_unique" UNIQUE("origin_calidad_fase_id")
);
--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_origin_work_item_id_work_items_id_fk" FOREIGN KEY ("origin_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_origin_correccion_id_correcciones_id_fk" FOREIGN KEY ("origin_correccion_id") REFERENCES "public"."correcciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_origin_calidad_fase_id_ficha_calidad_fases_id_fk" FOREIGN KEY ("origin_calidad_fase_id") REFERENCES "public"."ficha_calidad_fases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_requested_by_user_id_usuarios_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_assigned_decision_maker_id_usuarios_id_fk" FOREIGN KEY ("assigned_decision_maker_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_requested_info_by_id_usuarios_id_fk" FOREIGN KEY ("requested_info_by_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisiones" ADD CONSTRAINT "decisiones_resolved_by_user_id_usuarios_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;