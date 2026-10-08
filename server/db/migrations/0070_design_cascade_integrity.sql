-- Las referencias entre hijos del mismo proyecto se verifican al terminar
-- la transacción. Esto permite el CASCADE del proyecto sin depender del
-- orden de ejecución de sus triggers y sin perder la integridad referencial.
-- No se eliminan tablas, columnas ni datos.
ALTER TABLE "disenos" ALTER CONSTRAINT "disenos_direccion_creativa_id_direcciones_creativas_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "disenos" ALTER CONSTRAINT "disenos_correccion_id_correcciones_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "diseno_versiones" ALTER CONSTRAINT "diseno_versiones_revision_creativa_id_direcciones_creativas_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "diseno_versiones" ALTER CONSTRAINT "diseno_versiones_revision_interna_work_item_id_work_items_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "diseno_versiones" ALTER CONSTRAINT "diseno_versiones_calidad_work_item_id_work_items_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "diseno_versiones" ALTER CONSTRAINT "diseno_versiones_calidad_fase_id_ficha_calidad_fases_id_fk" DEFERRABLE INITIALLY DEFERRED;
