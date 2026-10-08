CREATE TABLE "diseno_versiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diseno_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"entrega_key" uuid NOT NULL,
	"enlace" text NOT NULL,
	"entregado_por_id" uuid NOT NULL,
	"entregado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"feedback" text,
	"feedback_en" timestamp with time zone,
	"cantidad_comentarios" integer,
	"enviada_autor_en" timestamp with time zone,
	"feedback_autor_due_at" timestamp with time zone,
	"aprobada_autor_en" timestamp with time zone,
	"revision_creativa_id" uuid,
	"revision_interna_work_item_id" uuid,
	"aprobada_interna_en" timestamp with time zone,
	"handoff_en" timestamp with time zone,
	"calidad_work_item_id" uuid,
	"calidad_fase_id" uuid,
	CONSTRAINT "diseno_versiones_numero_unique" UNIQUE("diseno_id","numero"),
	CONSTRAINT "diseno_versiones_entrega_unique" UNIQUE("diseno_id","entrega_key")
);
--> statement-breakpoint
CREATE TABLE "disenos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"direccion_creativa_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"solicitud_key" uuid NOT NULL,
	"fuente_url" text NOT NULL,
	"correccion_id" uuid,
	"aprobacion_edicion_url" text,
	"preparacion_confirmada" boolean DEFAULT false NOT NULL,
	"capitulos_muestra" integer,
	"dias_referencia" integer,
	"solicitado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"cerrado_en" timestamp with time zone,
	CONSTRAINT "disenos_work_item_id_unique" UNIQUE("work_item_id"),
	CONSTRAINT "disenos_proyecto_solicitud_unique" UNIQUE("proyecto_id","solicitud_key")
);
--> statement-breakpoint
ALTER TABLE "correcciones" ADD COLUMN "entregado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_diseno_id_disenos_id_fk" FOREIGN KEY ("diseno_id") REFERENCES "public"."disenos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_entregado_por_id_usuarios_id_fk" FOREIGN KEY ("entregado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_revision_creativa_id_direcciones_creativas_id_fk" FOREIGN KEY ("revision_creativa_id") REFERENCES "public"."direcciones_creativas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_revision_interna_work_item_id_work_items_id_fk" FOREIGN KEY ("revision_interna_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_calidad_work_item_id_work_items_id_fk" FOREIGN KEY ("calidad_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseno_versiones" ADD CONSTRAINT "diseno_versiones_calidad_fase_id_ficha_calidad_fases_id_fk" FOREIGN KEY ("calidad_fase_id") REFERENCES "public"."ficha_calidad_fases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_direccion_creativa_id_direcciones_creativas_id_fk" FOREIGN KEY ("direccion_creativa_id") REFERENCES "public"."direcciones_creativas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disenos" ADD CONSTRAINT "disenos_correccion_id_correcciones_id_fk" FOREIGN KEY ("correccion_id") REFERENCES "public"."correcciones"("id") ON DELETE no action ON UPDATE no action;