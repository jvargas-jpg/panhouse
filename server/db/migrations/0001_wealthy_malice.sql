CREATE TYPE "public"."categoria_stand_by" AS ENUM('retorno_breve', 'exoneracion_contractual');--> statement-breakpoint
CREATE TYPE "public"."origen_confirmacion_pago" AS ENUM('manual', 'webhook_pagos');--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "peso_complejidad" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "especialista_id" uuid;--> statement-breakpoint
ALTER TABLE "proyectos" ADD COLUMN "categoria_stand_by" "categoria_stand_by";--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "es_pausado_formal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "fecha_limite_retoma" date;--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "recargo_aplica" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "pago_confirmado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "origen_confirmacion_pago" "origen_confirmacion_pago";--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "confirmado_pago_por_id" uuid;--> statement-breakpoint
ALTER TABLE "pausas" ADD COLUMN "confirmado_pago_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_especialista_id_usuarios_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pausas" ADD CONSTRAINT "pausas_confirmado_pago_por_id_usuarios_id_fk" FOREIGN KEY ("confirmado_pago_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."pausas" ALTER COLUMN "causa" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."causa_pausa";--> statement-breakpoint
CREATE TYPE "public"."causa_pausa" AS ENUM('autor', 'otro_departamento');--> statement-breakpoint
ALTER TABLE "public"."pausas" ALTER COLUMN "causa" SET DATA TYPE "public"."causa_pausa" USING "causa"::"public"."causa_pausa";