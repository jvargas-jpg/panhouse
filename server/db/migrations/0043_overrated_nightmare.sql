CREATE TYPE "public"."ejecucion_servicio" AS ENUM('Normal', 'Exprés');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" SET DATA TYPE ejecucion_servicio USING (CASE WHEN "ingreso_servicio_ejecucion" IS NULL THEN 'Normal' ELSE "ingreso_servicio_ejecucion"::ejecucion_servicio END);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" SET DEFAULT 'Normal';--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_ejecucion" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_alianza" SET DATA TYPE boolean USING (CASE WHEN "ingreso_servicio_alianza" IS NULL THEN false ELSE "ingreso_servicio_alianza"::boolean END);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_alianza" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "ingreso_servicio_alianza" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" DROP COLUMN "ingreso_tema_general";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" DROP COLUMN "ingreso_servicio_perfil";