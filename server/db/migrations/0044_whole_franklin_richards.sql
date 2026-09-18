CREATE TYPE "public"."perfil_servicio" AS ENUM('Estándar', 'VIP');--> statement-breakpoint
CREATE TYPE "public"."presupuesto_servicio" AS ENUM('Plata', 'Oro', 'Platinium');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_presupuesto" SET DATA TYPE presupuesto_servicio USING ("ingreso_servicio_presupuesto"::presupuesto_servicio);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "ingreso_servicio_perfil" "perfil_servicio";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "ingreso_tiempo_expres_meses" integer;--> statement-breakpoint
ALTER TABLE "public"."fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."ejecucion_servicio";--> statement-breakpoint
CREATE TYPE "public"."ejecucion_servicio" AS ENUM('Normal', 'Express');--> statement-breakpoint
ALTER TABLE "public"."fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" SET DATA TYPE "public"."ejecucion_servicio" USING "ingreso_servicio_ejecucion"::"public"."ejecucion_servicio";--> statement-breakpoint
ALTER TABLE "public"."fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" SET DEFAULT 'Normal';