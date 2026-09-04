ALTER TABLE "proyectos" ADD COLUMN "propuesta_portada_url" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "portada_decision_autor" varchar(20) DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "portada_feedback" text;