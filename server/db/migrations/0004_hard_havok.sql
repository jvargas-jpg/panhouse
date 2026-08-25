CREATE TABLE "ficha_calidad_fases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ficha_id" uuid NOT NULL,
	"numero_fase" integer NOT NULL,
	"pdf_url" text,
	"pdf_version" text,
	"fecha" date,
	"aprobado" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ficha_calidad_fases_ficha_numero_unique" UNIQUE("ficha_id","numero_fase"),
	CONSTRAINT "ficha_calidad_fases_numero_valido" CHECK ("ficha_calidad_fases"."numero_fase" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "ficha_diseno_propuestas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ficha_id" uuid NOT NULL,
	"fecha" date,
	"descripcion" text,
	"enlace" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ficha_distribucion_paises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ficha_id" uuid NOT NULL,
	"pais" text NOT NULL,
	"porcentaje_regalias" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ficha_distribucion_paises_ficha_pais_unique" UNIQUE("ficha_id","pais")
);
--> statement-breakpoint
CREATE TABLE "ficha_lanzamiento_reuniones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ficha_id" uuid NOT NULL,
	"fecha" date,
	"puntos_tratados" text,
	"acuerdos" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "perfil_autor" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "publico_objetivo" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "objetivos_comerciales" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "capitulos_pactados" integer;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "paginas_pactadas" integer;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_tripa_completa" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_preliminares" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "correccion_cubierta_extendida" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "diseno_brief_creativo" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "soporte_digital_cuenta_amazon" text;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "soporte_digital_fecha_envio_formulario" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "soporte_digital_fecha_activacion" date;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD COLUMN "impresion_notas" text;--> statement-breakpoint
ALTER TABLE "ficha_calidad_fases" ADD CONSTRAINT "ficha_calidad_fases_ficha_id_fichas_trazabilidad_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_trazabilidad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_diseno_propuestas" ADD CONSTRAINT "ficha_diseno_propuestas_ficha_id_fichas_trazabilidad_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_trazabilidad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_distribucion_paises" ADD CONSTRAINT "ficha_distribucion_paises_ficha_id_fichas_trazabilidad_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_trazabilidad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_lanzamiento_reuniones" ADD CONSTRAINT "ficha_lanzamiento_reuniones_ficha_id_fichas_trazabilidad_id_fk" FOREIGN KEY ("ficha_id") REFERENCES "public"."fichas_trazabilidad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_trazabilidad" ADD CONSTRAINT "fichas_trazabilidad_proyecto_id_unique" UNIQUE("proyecto_id");