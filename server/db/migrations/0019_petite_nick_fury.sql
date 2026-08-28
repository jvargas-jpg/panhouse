ALTER TABLE "fichas_trazabilidad" ADD COLUMN "edicion_estatus" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "edicion_fecha_envio_editor" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "edicion_fecha_recepcion_editor" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "edicion_fecha_envio_autor" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "edicion_fecha_aprobacion_autor" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "edicion_observaciones" text;