CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"fecha_pago" date NOT NULL,
	"metodo_pago" text NOT NULL,
	"referencia" text,
	"comprobante_url" text,
	"estatus" text DEFAULT 'Pendiente de verificación' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;