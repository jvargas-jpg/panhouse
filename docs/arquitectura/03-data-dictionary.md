# Documento 03 — Diccionario de Datos Maestro (Data Dictionary)
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  

Este diccionario consolida y normaliza cada campo identificado en las fuentes primarias de negocio (Ficha PED-FOR-001, Matriz IA PED-FOR-002, Matriz RRPP, Matriz Editores, Seguimiento Corrección), código fuente y base de datos PostgreSQL.

---

## 1. Clasificación Conceptual de Datos
- **A. CANÓNICO:** Dato maestro primario; existe en un único lugar de almacenamiento.
- **B. REFERENCIA:** Dato canónico proyectado o leído en vistas/dashboards de otros roles (no se duplica).
- **C. DERIVADO:** Dato calculado dinámicamente mediante consultas o reglas de negocio (ej. `listoParaRrpp`, `retrasado`, `diasEjecucion`).
- **D. HISTÓRICO:** Registro inmutable de un hecho acontecido con fecha, persona y contexto (ej. auditoría, rondas de versión, pagos).
- **E. WORKFLOW:** Estado, asignación, tarea activa, gate o compuerta de proceso.
- **F. CONFIGURACIÓN:** Parámetros de catálogo, SLAs, reglas o pesos de complejidad.

---

## 2. Inventario Exhaustivo de Campos

### 2.1 Entidad Canónica: AUTOR (`autores`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Nombre del autor | Ficha / Matriz IA / RRPP / Editores | Todas | Nombre completo oficial y legal del autor | Comercial | `autores` | `autores.nombre` | `text` | Req | Persistido | Ficha, Matriz IA, RRPP, Editores, Seguimiento | **Dato maestro único.** Las matrices leen esta columna vía join. |
| Nombre artístico | Ficha PED-FOR-001 | Datos de ingreso | Pseudónimo o nombre público con el que firma su obra | Comercial | `autores` | `autores.nombre_artistico` | `text` | Opc | Persistido | Ficha Ingreso | Propiedad personal del autor. |
| País donde está ubicado | Ficha / RRPP | Ingreso / RRPP | País de residencia habitual del autor | Comercial | `autores` | `autores.pais` | `text` | Req | Persistido | Ficha, Matriz RRPP | Valida formato y catálogo de países. |
| Nacionalidad | Ficha / RRPP | Ingreso / RRPP | Nacionalidad(es) legal(es) del autor (soporta múltiple) | Comercial | `autores` | `autores.nacionalidad` | `text[]` | Req | Persistido | Ficha, Matriz RRPP | Modelado como array de texto nativo. |
| Fecha de nacimiento | Ficha PED-FOR-001 | Datos de ingreso | Fecha natal del autor | Comercial | `autores` | `autores.fecha_nacimiento` | `date` | Opc | Persistido | Ficha Ingreso | Formato ISO `YYYY-MM-DD`. |
| Email / Correo | Ficha PED-FOR-001 | Datos de ingreso | Correos electrónicos de contacto | Comercial | `autores` | `autores.email` | `text[]` | Req | Persistido | Ficha Ingreso | Array de emails de contacto. |
| Teléfono | Ficha PED-FOR-001 | Datos de ingreso | Teléfono / WhatsApp con código de país | Comercial | `autores` | `autores.telefono` | `text` | Req | Persistido | Ficha Ingreso | Canal principal de comunicación del especialista. |
| Redes sociales | Ficha PED-FOR-001 | Datos de ingreso | Perfil digital (Instagram, X, Facebook, LinkedIn, TikTok, YouTube) | Comercial | `autores` | `autores.redes_sociales` | `jsonb` | Opc | Persistido | Ficha Ingreso | Estructurado como objeto `jsonb`. |
| Personalidad | Ficha PED-FOR-001 | Datos de ingreso | Rasgos conductuales del autor (Perfeccionista, Carismático, etc.) | Comercial | `autores` | `autores.personalidad` | `text[]` | Opc | Persistido | Ficha Ingreso | Permite al especialista adecuar el trato interpersonal. |
| ¿Qué hace y a qué se dedica? | Ficha PED-FOR-001 | Datos de ingreso | Ocupación, profesión, cargos o actividad relevante | Comercial | `autores` | `autores.ocupacion` | `text` | Opc | Persistido | Ficha Ingreso | Contexto para el editor y líder creativo. |
| Categoría / Relevancia del autor | Matriz IA / Ficha | BBD-IA / Ingreso | Categoría comercial del cliente (`Estándar`, `VIP`) | Comercial | `autores` | `autores.categoria` | `enum` | Req | Persistido | Matriz IA (columna "Relevancia del autor"), Ficha | Controla badges y prioridad de asignación. |

---

### 2.2 Entidad Canónica: PROYECTO & CONTRATO (`proyectos`, `proyectos_autores`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ID de Proyecto | DB / Sistema | N/A | Identificador único universal | Sistema | `proyectos` | `proyectos.id` | `uuid` | Req | Persistido | N/A | Clave primaria. |
| Código de Proyecto | Sistema | N/A | Identificador corto visible (ej. `PH-A1B2`) | Sistema | `proyectos` | `proyectos.codigo` | `text` | Req | Persistido | N/A | Alfanumérico único generado al crear el proyecto. |
| Autor Principal | DB / Ficha | N/A | Relación hacia el autor principal | Comercial | `proyectos` | `proyectos.autor_id` | `uuid` (FK) | Req | Persistido | Todas las matrices | Se complementa con `proyectos_autores` para coautoría. |
| Coautores | Sistema | N/A | Asociación N:M de autores para libros en coautoría | Comercial | `proyectos_autores` | `proyectos_autores` | `uuid[]` | Opc | Persistido | N/A | Permite N autores por libro. |
| Servicio | Ficha / Matriz IA / Editores | Todas | Servicio contratado (`EF`, `EEC`, `EET`, `SE`, `CR`) | Comercial | `proyectos` | `proyectos.servicio_id` | `uuid` (FK) | Req | Persistido | Repetido en 5 matrices | Determina plazos y flujo de actividades. |
| Unidad | Matriz IA / RRPP | BBD-IA / Ingreso | Sello o unidad de negocio (`PanHouse`, `Maxwell`, `ILC`, etc.) | Comercial | `proyectos` | `proyectos.unidad_id` | `uuid` (FK) | Req | Persistido | Ficha, Matriz IA, RRPP | FK a catálogo `unidades`. |
| Presupuesto | Ficha / Matriz IA | Ingreso / BBD-IA | Nivel presupuestario (`Plata`, `Oro`, `Platinium`) | Comercial | `proyectos` | `proyectos.presupuesto_id` | `uuid` (FK) | Req | Persistido | Ficha, Matriz IA | FK a catálogo `presupuestos`. |
| Colección PanHouse | Ficha / Matriz IA | Ficha Ed. / BBD-IA | Colección editorial temática asignada | RRPP | `proyectos` | `proyectos.coleccion_id` / `fichas.coleccion` | `enum` | Req | Persistido | Ficha, Matriz IA | **Definido exclusivamente por RRPP**. |
| Fecha de ingreso / Firma de contrato | Ficha / Matriz IA / RRPP | Todas | Fecha legal de inicio contractual | Comercial | `proyectos` | `proyectos.fecha_programada_inicio` | `date` | Req | Persistido | Repetido en todas | Base para el cómputo de cronograma y SLA. |
| Fecha real de inicio | Ficha / Matriz IA | BBD-IA | Fecha real cuando el autor entrega insumos | Especialista | `proyectos` | `proyectos.fecha_real_inicio` | `date` | Opc | Persistido | Matriz IA | Se documenta si el autor pide inicio diferido. |
| Fecha fin proyectada | Matriz IA / Ficha | BBD-IA / Ingreso | Fecha calculada de entrega final según SLA de servicio | Sistema / Backend | `proyectos` | `proyectos.fecha_fin_proyectada` | `date` | Req | Derivado | Matriz IA, Ficha | `fecha_inicio + plazo_dias`. |
| Fecha fin deseada | Matriz IA / Ficha | BBD-IA / Proy. | Fecha requerida por el autor para su lanzamiento | RRPP / Autor | `proyectos` | `proyectos.fecha_deseada_autor` | `date` | Opc | Persistido | Matriz IA, Ficha | Meta voluntaria del cliente. |
| Estado macro del proyecto | Matriz IA | BBD-IA | `en_proceso`, `retrasado`, `stand_by`, `pausado`, `culminado`, `retirado` | Jefatura | `proyectos` | `proyectos.estado` | `enum` | Req | Persistido | Matriz IA | Gobernado por guardias del backend. |
| Subtipo de Crudo | Ficha / Matriz IA | Ingreso / BBD-IA | `Capítulo` vs `Tripa` (Solo para servicio Crudo) | RRPP | `fichas_trazabilidad` | `ingreso_servicio_subtipo_crudo` | `enum` | Opc (Req en Crudo) | Persistido | Ficha, Matriz IA | **Prohibido para Comercial. Exclusivo RRPP.** |
| Ejecución del servicio | Ficha PED-FOR-001 | Datos de ingreso | `Normal` vs `Express` (con meses) | Comercial | `fichas_trazabilidad` | `ingreso_servicio_ejecucion` | `enum` | Req | Persistido | Ficha | Default `Normal`. |
| Alianza comercial | Ficha PED-FOR-001 | Datos de ingreso | Si el proyecto proviene de alianza institucional | Comercial | `fichas_trazabilidad` | `ingreso_servicio_alianza` | `boolean` | Req | Persistido | Ficha | Boolean `true/false`. |
| Capítulos pactados | Ficha PED-FOR-001 | Especificaciones | Cantidad de capítulos fijados por contrato | Comercial | `fichas_trazabilidad` | `capitulos_pactados` | `text` | Req | Persistido | Ficha | Rango o número contractual (ej. '6', '1 a 5'). |
| Páginas pactadas / diagramadas | Ficha PED-FOR-001 | Especificaciones | Rango de páginas contratadas (ej. '150 a 200') | Comercial | `fichas_trazabilidad` | `paginas_pactadas` | `text` | Req | Persistido | Ficha | Rango o estimado contractual. |
| Criterio extra contractual | Ficha PED-FOR-001 | Especificaciones | Exclusiones o condiciones particulares (ej. sin portada) | Comercial | `fichas_trazabilidad` | `criterio_extra` | `text` | Opc | Persistido | Ficha | Texto legal del contrato. |
| Condiciones especiales | Ficha PED-FOR-001 | Especificaciones | Ilustraciones, gráficos, diagramación especial / ultra esp. | Comercial | `fichas_trazabilidad` | `condiciones_especiales` | `enum[]` | Opc | Persistido | Ficha | Array de chips cerrados. |

---

### 2.3 Entidad Canónica: ASIGNACIONES DE EQUIPO (`proyectos`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Especialista / Coordinador | Ficha / Matriz IA / RRPP / Editores | Todas | Especialista editorial responsable del proyecto | Jefatura de Área | `proyectos` | `proyectos.especialista_id` | `uuid` (FK) | Req (tras intake) | Persistido | Repetido en todas | **Una sola asignación formal en DB**. |
| Jefa de Área | Matriz IA / Ficha | BBD-IA / Proy. | Líder departamental asignada al caso | Jefatura de Área | `proyectos` | `proyectos.jefe_area_id` | `uuid` (FK) | Req | Persistido | Matriz IA, Ficha | Mariángely Romero o Sthephania Silva. |
| Editor asignado | Ficha / Matriz IA / Editores | Todas | Editor responsable del manuscrito | Jefatura de Edición | `proyectos` | `proyectos.editor_id` | `uuid` (FK) | Opc | Persistido | Ficha, Matriz IA, Editores | Asignado formalmente por Jefe de Edición. |
| Corrector asignado | Ficha / Matriz IA / Seguimiento | Todas | Corrector freelance o interno | Especialista | `proyectos` | `proyectos.corrector_id` | `uuid` (FK) | Opc | Persistido | Ficha, Matriz IA, Corrección | Coordinado vía Talento Humano. |
| Diseñador asignado | Ficha / Matriz IA | Proy. / BBD-IA | Diseñador gráfico maquetador | Especialista | `proyectos` | `proyectos.disenador_id` | `uuid` (FK) | Opc | Persistido | Ficha, Matriz IA | Asignado según carga por Especialista. |

---

### 2.4 Ficha Editorial & Diagnóstico RRPP (`fichas_trazabilidad`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Tema general | Ficha PED-FOR-001 | Especificaciones | Descripción del tema central de la obra | RRPP | `fichas_trazabilidad` | `tema_general` | `text` | Req | Persistido | Ficha Editorial | Insumo clave para clasificación y diseño. |
| Público objetivo (Sexo) | Ficha PED-FOR-001 | Especificaciones | `Masculino`, `Femenino`, `Mixto` | RRPP | `fichas_trazabilidad` | `publico_sexo` | `enum` | Req | Persistido | Ficha Editorial | Perfil demográfico. |
| Público objetivo (Edad) | Ficha PED-FOR-001 | Especificaciones | Rango de edad de los lectores esperados | RRPP | `fichas_trazabilidad` | `publico_edad` | `text` | Req | Persistido | Ficha Editorial | Texto sugerido. |
| Perfil / Ocupación lector | Ficha PED-FOR-001 | Especificaciones | Intereses y educación del lector objetivo | RRPP | `fichas_trazabilidad` | `publico_perfil` | `text` | Req | Persistido | Ficha Editorial | Orientación de estilo. |
| Propósito social | Ficha PED-FOR-001 | Especificaciones | Impacto social o legado del libro | RRPP | `fichas_trazabilidad` | `proposito_social` | `text` | Opc | Persistido | Ficha Editorial | Misión de la obra. |
| Objetivo comercial | Ficha PED-FOR-001 | Especificaciones | Posicionamiento, ventas, conferencias, marca | RRPP | `fichas_trazabilidad` | `objetivo_comercial` | `text[]` | Opc | Persistido | Ficha Editorial | Metas comerciales del autor. |
| Tono y estilo | Ficha PED-FOR-001 | Especificaciones | Registro comunicativo (sencillo, formal, etc.) | RRPP | `fichas_trazabilidad` | `tono_estilo` | `text` | Req | Persistido | Ficha Editorial | Pauta para la edición y corrección. |
| Título tentativo / libro | Ficha / Matriz IA / RRPP | Todas | Título propuesto inicialmente | RRPP | `fichas_trazabilidad` | `posible_titulo_libro` | `text` | Req | Persistido | Repetido en 4 fuentes | Provisorio hasta el gate de título. |
| Título definitivo | Ficha PED-FOR-001 | Diseño / Impresión | Título final pactado con el autor | Especialista / Autor | `fichas_trazabilidad` | Por consolidar | `text` | Req (gate) | Persistido | Ficha, Matriz IA | **Gate obligatorio para reunión creativa**. |
| Subtítulo definitivo | Ficha PED-FOR-001 | Diseño / Impresión | Subtítulo definitivo aprobado | Especialista / Autor | `fichas_trazabilidad` | Por consolidar | `text` | Opc | Persistido | Ficha | Requerido para portada y cubierta. |

---

### 2.5 Edición Capítulo a Capítulo (`capitulos`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Número de capítulo / parte | Ficha / Editores | Edición / BBD-Editores | Número correlativo (C1..C6 o Parte 1..2) | Editor | `capitulos` | `capitulos.numero` | `integer` | Req | Persistido | Ficha, Editores | Único por proyecto. |
| Link del archivo editado | Ficha / Editores | Edición | Enlace a Google Drive del archivo editado | Editor | `capitulos` | `capitulos.enlaces` | `jsonb` | Opc | Persistido | Ficha Edición | Reposa en carpeta "Editado". |
| Fecha envío a feedback | Ficha / Editores | Edición | Fecha en que especialista envía al autor | Especialista | `capitulos` | `capitulos.fecha_envio_autor` | `date` | Opc | Persistido | Ficha, Editores | Dispara plazo del autor. |
| Fecha pautada feedback | Ficha / Editores | Edición | Plazo límite (3 días capítulo / 5 días tripa) | Sistema | `capitulos` | `capitulos.fecha_pautada_feedback` | `date` | Opc | Derivado/Persist | Ficha, Editores | Calculado automáticamente. |
| Fecha registrada feedback | Ficha / Editores | Edición | Fecha real en que el autor devolvió cambios | Especialista | `capitulos` | `capitulos.fecha_respuesta_real` | `date` | Opc | Persistido | Ficha, Editores | Mide cumplimiento del autor. |
| Páginas del capítulo | Editores | BBD-Editores | Páginas Word entregadas por el editor | Editor | `capitulos` | `capitulos.paginas` | `integer` | Opc | Persistido | Matriz Editores | Base para métricas de edición. |
| Fecha inicio editor | Editores | BBD-Editores | Fecha en que el editor inicia el capítulo | Editor | `capitulos` | `capitulos.fecha_inicio_editor` | `date` | Opc | Persistido | Matriz Editores | Plazo máximo de 3 días laborables. |
| Fecha entrega editor | Editores | BBD-Editores | Fecha real de entrega del editor | Editor | `capitulos` | `capitulos.fecha_entrega_editor` | `date` | Opc | Persistido | Matriz Editores | Mide SLA del editor. |

---

### 2.6 Diseño, Creativa y Portada (`fichas_trazabilidad`, `ficha_diseno_propuestas`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Brief creativo | Ficha PED-FOR-001 | Diseño | Documento de alineación conceptual | Líder Creativo | `fichas_trazabilidad` | `diseno_brief_creativo` | `text` (URL) | Req | Persistido | Ficha Diseño | Aprobado por el autor en máx. 1 día. |
| Tipo de portada | Ficha PED-FOR-001 | Diseño | `tipografica`, `fotografica`, `ilustrada` | Líder Creativo | `fichas_trazabilidad` | `diseno_tipo_portada` | `enum` | Req | Persistido | Ficha Diseño | Pauta técnica de portada. |
| Propuestas de portada | Ficha PED-FOR-001 | Diseño | 2 a 3 conceptos de portada generados | Líder Creativo | `ficha_diseno_propuestas` | `ficha_diseno_propuestas` | Filas 1:N | Req | Persistido | Ficha Diseño | **RRPP aprueba antes del autor**. |
| Aprobación portada RRPP | Manual 4.1.2 | Proceso Creativo | Visto bueno formal de RRPP | RRPP | `fichas_trazabilidad` | Por formalizar | `boolean/date` | Req | Histórico | Manual | Gate previo a vista de autor. |
| Elección portada autor | Ficha / Portal | Diseño / Portal | Portada aprobada por el autor | Autor | `proyectos` | `portada_decision_autor` | `varchar` | Req | Persistido | Ficha, Portal | `pendiente`, `aprobada`, `rechazada`. |
| Muestra diagramación | Ficha PED-FOR-001 | Diseño | Entrega de 3 capítulos para validar estilo | Diseñador | `fichas_trazabilidad` | Columnas muestra | Fechas | Req | Persistido | Ficha Diseño | 3 días diseñador / 1 día autor. |
| Cubierta extendida | Ficha PED-FOR-001 | Diseño | Portada, lomo, contraportada con solapas | Diseñador | `fichas_trazabilidad` | Columnas cubierta | Fechas | Req | Persistido | Ficha Diseño | Verificada por Líder Creativo. |
| Paquete final | Ficha PED-FOR-001 | Diseño | Tripas, cubiertas, KDP, EPUB, editables | Diseñador | `fichas_trazabilidad` | Columnas paquete | Booleans | Req | Persistido | Ficha Diseño | Checklist de 10 archivos. |

---

### 2.7 Calidad y Validación Iterativa (`ficha_calidad_fases`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fase de Calidad | Ficha PED-FOR-001 | Calidad | Número de iteración / fase (1 a 4+) | Validador | `ficha_calidad_fases` | `numero_fase` | `integer` | Req | Persistido | Ficha Calidad | 1=V1, 2=F2.x, 3=RF, 4=F4.x |
| Versión PDF | Ficha PED-FOR-001 | Calidad | Código de versión (ej. `V1.0`, `V1.1`) | Diseñador | `ficha_calidad_fases` | `pdf_version` | `text` | Req | Persistido | Ficha Calidad | Trazabilidad de archivos. |
| URL del PDF | Ficha PED-FOR-001 | Calidad | Enlace a Drive del archivo comentado | Validador | `ficha_calidad_fases` | `pdf_url` | `text` | Req | Persistido | Ficha Calidad | Archivo con anotaciones. |
| Cantidad comentarios | Ficha / Seguimiento | Calidad / Seg. | Número de comentarios/incidencias halladas | Validador | `ficha_calidad_fases` | `cantidad_comentarios` | `integer` | Opc | Persistido | Ficha, Seguimiento | Mide calidad del diseño. |
| Estado de aprobación | Ficha PED-FOR-001 | Calidad | Si la versión fue aprobada o rechazada | Validador | `ficha_calidad_fases` | `aprobado` | `boolean` | Req | Persistido | Ficha Calidad | Nullable mientras revisa. |

---

### 2.8 Soporte Digital / Amazon KDP (`fichas_trazabilidad`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cuenta Amazon KDP | Ficha PED-FOR-001 | Soporte Digital | Estado / Identificador de cuenta de autor | Soporte Digital | `fichas_trazabilidad` | `soporte_digital_cuenta_amazon` | `text` | Req | Persistido | Ficha | Creada por soporte digital. |
| Fecha envío formulario | Ficha PED-FOR-001 | Soporte Digital | Fecha en que se envía el formulario al autor | Soporte Digital | `fichas_trazabilidad` | `soporte_digital_fecha_envio_formulario` | `date` | Req | Persistido | Ficha | Disparado al entrar a Fase 1. |
| Criterios Amazon | Ficha PED-FOR-001 | Soporte Digital | Tapa, portada, papel, precio KDP, Kindle | Soporte Digital | `fichas_trazabilidad` | Columnas criterios | Mixto | Req | Persistido | Ficha | Pactado en reunión con el autor. |
| Fecha activación / carga | Ficha PED-FOR-001 | Soporte Digital | Fecha de publicación en vivo en Amazon | Soporte Digital | `fichas_trazabilidad` | `soporte_digital_fecha_activacion` | `date` | Req | Persistido | Ficha | Requiere solvencia administrativa. |

---

### 2.9 Control Financiero y Cobranzas (`proyectos`, `pagos`)

| Nombre Original | Fuente | Hoja | Descripción | Responsable | Entidad Canónica | Campo DB Actual | Tipo | Req/Opc | Persist/Deriv | Duplicados en Fuentes | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Contrato firmado | Matriz IA / RRPP | BBD-IA / RRPP | Confirmación legal de firma del contrato | Comercial / Admin | `proyectos` | `contrato_firmado` / `matriz_contrato_firmado` | `boolean` | Req | Persistido | Matriz IA, RRPP | Insumo de entrada. |
| Solvencia Administrativa | Matriz IA / Manual | BBD-IA / Paquete | Visto bueno formal de Cobranzas para liberar artes | Cobranzas | `proyectos` | Por consolidar | `boolean` | Req (gate) | Persistido | Matriz IA, Manual | **Gate obligatorio para entrega de paquete final**. |
| Cuotas de pago (1 a 6) | Matriz IA | BBD-IA | Registro de cuotas pagadas | Cobranzas | `proyectos` | `pago_cuota_1..6` | `boolean[]` | Opc | Persistido | Matriz IA | Cuotas contractuales. |
| Abonos y Pagos | Sistema | Pagos | Registro transaccional de pagos | Cobranzas | `pagos` | `pagos` (tabla) | Filas 1:N | Opc | Histórico | N/A | Monto, fecha, método, comprobante. |
