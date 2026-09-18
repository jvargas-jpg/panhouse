CREATE TYPE "public"."propietario_matriz_ingreso" AS ENUM('Paola Morales', 'Daniel Valente');--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "matriz_propietario" TYPE "public"."propietario_matriz_ingreso" USING (
  CASE WHEN "matriz_propietario" IN ('Paola Morales', 'Daniel Valente')
    THEN "matriz_propietario"::"public"."propietario_matriz_ingreso"
    ELSE NULL
  END
);