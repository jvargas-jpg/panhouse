CREATE TABLE "creative_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"creative_process_id" uuid NOT NULL,
	"concept_id" uuid,
	"type" text NOT NULL,
	"drive_file_id" text,
	"drive_url" text NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creative_delivery_process_type_unique" UNIQUE("creative_process_id","type")
);
--> statement-breakpoint
ALTER TABLE "direcciones_creativas" ADD COLUMN "brief_feedback" text;--> statement-breakpoint
ALTER TABLE "direcciones_creativas" ADD COLUMN "brief_feedback_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "feedback_rrpp" text;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "feedback_autor" text;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "revised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creative_deliveries" ADD CONSTRAINT "creative_deliveries_project_id_proyectos_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_deliveries" ADD CONSTRAINT "creative_deliveries_creative_process_id_direcciones_creativas_id_fk" FOREIGN KEY ("creative_process_id") REFERENCES "public"."direcciones_creativas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_deliveries" ADD CONSTRAINT "creative_deliveries_concept_id_ficha_diseno_propuestas_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."ficha_diseno_propuestas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_deliveries" ADD CONSTRAINT "creative_deliveries_submitted_by_usuarios_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;