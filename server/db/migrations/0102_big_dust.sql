ALTER TABLE "validation_delivery_outbox" ALTER COLUMN "phase_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "validation_delivery_outbox" ADD COLUMN "version_id" uuid;--> statement-breakpoint
ALTER TABLE "validation_delivery_outbox" ADD CONSTRAINT "validation_delivery_outbox_version_id_diseno_versiones_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."diseno_versiones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_delivery_outbox" ADD CONSTRAINT "validation_delivery_outbox_version_id_unique" UNIQUE("version_id");