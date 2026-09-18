CREATE TYPE "public"."coleccion_panhouse" AS ENUM('Crecimiento Espiritual', 'Emprendimiento y Crecimiento Personal', 'Literatura', 'Salud y Bienestar', 'Sin asignar', 'Liderazgo', 'Ciencias sociales', 'PanHouse Kids');--> statement-breakpoint
CREATE TYPE "public"."publico_sexo" AS ENUM('Masculino', 'Femenino', 'Mixto');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "fecha_deseada_culminacion" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "tema_general" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "posible_titulo_libro" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "coleccion_panhouse" "coleccion_panhouse";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "tono_estilo" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "publico_sexo" "publico_sexo";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "publico_edad" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "publico_perfil" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "proposito_social" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "objetivo_comercial" text[];