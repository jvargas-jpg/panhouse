ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion','creativa','editor','editor_apoyo','editor_reasignacion','editor_aclaracion','corrector_material','corrector_aclaracion','corrector_tecnico'));
