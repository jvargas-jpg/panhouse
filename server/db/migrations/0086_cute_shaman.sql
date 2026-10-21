ALTER TABLE "solicitudes_area" ALTER COLUMN "work_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ALTER COLUMN "requested_by_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD COLUMN "target_user_id" uuid;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD COLUMN "descripcion" text;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_target_user_id_usuarios_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_area" ADD CONSTRAINT "solicitudes_area_conversion_valid" CHECK (("solicitudes_area"."tipo"='creativa' or ("solicitudes_area"."work_item_id" is not null and "solicitudes_area"."requested_by_id" is not null)) and ("solicitudes_area"."tipo"<>'creativa' or "solicitudes_area"."estado"<>'resuelta' or "solicitudes_area"."work_item_id" is not null));
--> statement-breakpoint
ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion','creativa'));
