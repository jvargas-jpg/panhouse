ALTER TABLE "pausas" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_plazo_unico_o_doble" CHECK (("servicios"."plazo_dias" is not null and "servicios"."plazo_interno_dias" is null and "servicios"."plazo_comercial_dias" is null)
          or
          ("servicios"."plazo_dias" is null and "servicios"."plazo_interno_dias" is not null and "servicios"."plazo_comercial_dias" is not null));--> statement-breakpoint
ALTER TABLE "pausas" ADD CONSTRAINT "pausas_pago_confirmado_requiere_origen" CHECK ("pausas"."pago_confirmado" = false or "pausas"."origen_confirmacion_pago" is not null);