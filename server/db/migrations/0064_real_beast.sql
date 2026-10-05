ALTER TABLE "work_items" DROP CONSTRAINT "work_items_proyecto_tipo_unique";--> statement-breakpoint
ALTER TABLE "work_items" ALTER COLUMN "tipo" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "business_key" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "paso_id" uuid;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_paso_id_pasos_id_fk" FOREIGN KEY ("paso_id") REFERENCES "public"."pasos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_proyecto_tipo_business_key_unique" UNIQUE("proyecto_id","tipo","business_key");--> statement-breakpoint
DROP TYPE "public"."tipo_work_item";