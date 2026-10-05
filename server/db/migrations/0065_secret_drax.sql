ALTER TABLE "proyectos" ADD COLUMN "titulo_definitivo" text;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "subtitulo_definitivo" text;--> statement-breakpoint
ALTER TABLE "capitulos" ADD COLUMN "observaciones_editor" text;--> statement-breakpoint
ALTER TABLE "capitulos" ADD COLUMN "observaciones" text;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "nombre_quien_recibe" text;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "cantidad_paginas" integer;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "cambios_por_verificar" integer;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "cambios_pendientes_por_aplicar" integer;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD COLUMN "cambios_nuevos_sugeridos" integer;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD COLUMN "fecha_aprobada_rrpp" date;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "listado_correctores" text;--> statement-breakpoint
ALTER TABLE "seguimiento_fases" ADD COLUMN "observaciones_fase_1" text;