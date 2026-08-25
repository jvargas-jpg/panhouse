CREATE TYPE "public"."tipo_portada" AS ENUM('tipografica', 'fotografica', 'ilustrada');--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "titulo" text;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "fecha_enviada_especialista" date;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "fecha_enviada_autor" date;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "fecha_aprobada_autor" date;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "estado" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_tipo_portada" "tipo_portada";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_fecha_reunion_creativa" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_fecha_entrega_brief" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_brief_aprobado_fecha" date;