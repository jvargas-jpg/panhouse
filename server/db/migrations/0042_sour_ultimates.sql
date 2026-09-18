CREATE TYPE "public"."categoria_cliente" AS ENUM('Estándar', 'VIP');--> statement-breakpoint
ALTER TABLE "autores" ADD COLUMN "categoria" "categoria_cliente" DEFAULT 'Estándar' NOT NULL;