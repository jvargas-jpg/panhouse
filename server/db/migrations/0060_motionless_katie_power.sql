ALTER TABLE "proyectos" DROP CONSTRAINT "proyectos_calidad_id_usuarios_id_fk";
--> statement-breakpoint
ALTER TABLE "proyectos" DROP CONSTRAINT "proyectos_digital_id_usuarios_id_fk";
--> statement-breakpoint
ALTER TABLE "proyectos" DROP CONSTRAINT "proyectos_lanzamiento_id_usuarios_id_fk";
--> statement-breakpoint
ALTER TABLE "proyectos" DROP CONSTRAINT "proyectos_distribucion_id_usuarios_id_fk";
--> statement-breakpoint
ALTER TABLE "proyectos" DROP COLUMN "calidad_id";--> statement-breakpoint
ALTER TABLE "proyectos" DROP COLUMN "digital_id";--> statement-breakpoint
ALTER TABLE "proyectos" DROP COLUMN "lanzamiento_id";--> statement-breakpoint
ALTER TABLE "proyectos" DROP COLUMN "distribucion_id";