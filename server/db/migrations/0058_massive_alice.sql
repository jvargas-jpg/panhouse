CREATE TYPE "public"."asesoria_estado" AS ENUM('Completado', 'Con fecha de lanzamiento', 'En proceso editorial', 'Finalizado');--> statement-breakpoint
CREATE TYPE "public"."asesoria_fase" AS ENUM('En asesoramiento', 'Esperando fecha', 'En espera de lanzamiento', 'Culminado');--> statement-breakpoint
CREATE TYPE "public"."asesoria_feria_a_participar" AS ENUM('Bogotá', 'Guadalajara', 'Panamá', 'Ambas');--> statement-breakpoint
CREATE TYPE "public"."asesoria_feria_proyectada" AS ENUM('Bogotá', 'Colombia', 'Guadalajara', 'Panamá');--> statement-breakpoint
CREATE TYPE "public"."asesoria_futuro_autor" AS ENUM('Desea ser publicado', 'No desea ser publicado aún', 'Publicado');--> statement-breakpoint
CREATE TYPE "public"."asesoria_nivel_satisfaccion" AS ENUM('Bueno', 'Excelente', 'Regular');--> statement-breakpoint
CREATE TYPE "public"."asesoria_responsable_distribucion" AS ENUM('Paola Morales', 'Distribución PanHouse');--> statement-breakpoint
CREATE TYPE "public"."asesoria_responsable_impresion" AS ENUM('Barbara Carballo', 'Impresiones PanHouse - Casa Editorial PanHouse', 'Paola Morales', 'Miranda Cedillo');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_estado" "asesoria_estado";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_especialista_responsable" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_primera_reunion" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_segunda_reunion" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_adicional" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_isbn_pais" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_nivel_satisfaccion" "asesoria_nivel_satisfaccion";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fase" "asesoria_fase";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_sugerida_ge" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_pautada_autor" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_feria_proyectada" "asesoria_feria_proyectada";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_notas" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_link_minuta_gerencia" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_ruta_promocion_enviada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_link_ruta_promocion" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_futuro_autor" "asesoria_futuro_autor";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_info_feria_enviada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_participacion_feria" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_feria_a_participar" "asesoria_feria_a_participar";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_cotizacion_impresion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_responsable_impresion" "asesoria_responsable_impresion";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_cotizacion_solicitada" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_cotizacion_enviada" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_cotizacion_aceptada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_distribucion_aceptada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_responsable_distribucion" "asesoria_responsable_distribucion";--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_nota_distribucion" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_fecha_contrato_enviado" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "asesoria_contrato_recibido_firmado" boolean DEFAULT false NOT NULL;