CREATE TYPE "public"."participacion_ferias" AS ENUM('Sí', 'No', 'Pendiente');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_fecha_primera_reunion" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_encargado_primera_reunion" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_puntos_tratados_primera" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_fecha_segunda_reunion" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_encargado_segunda_reunion" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_acuerdos_segunda" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_objetivo_comercial" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_participacion_ferias" "participacion_ferias";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_isbn" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_detalles_proyeccion" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_fecha_tentativa" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_tipo" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_observaciones" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_observaciones_generales" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "lanzamiento_promocion_link_minuta" text;