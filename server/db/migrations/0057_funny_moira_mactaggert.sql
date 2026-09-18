ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "lanzamiento_promocion_encargado_primera_reunion" TYPE "public"."propietario_matriz_ingreso" USING (
  CASE WHEN "lanzamiento_promocion_encargado_primera_reunion" IN ('Paola Morales', 'Daniel Valente')
    THEN "lanzamiento_promocion_encargado_primera_reunion"::"public"."propietario_matriz_ingreso"
    ELSE NULL
  END
);--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ALTER COLUMN "lanzamiento_promocion_encargado_segunda_reunion" TYPE "public"."propietario_matriz_ingreso" USING (
  CASE WHEN "lanzamiento_promocion_encargado_segunda_reunion" IN ('Paola Morales', 'Daniel Valente')
    THEN "lanzamiento_promocion_encargado_segunda_reunion"::"public"."propietario_matriz_ingreso"
    ELSE NULL
  END
);