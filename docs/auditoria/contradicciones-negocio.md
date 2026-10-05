# Registro de Contradicciones y Discrepancias de Negocio
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  
**Estado:** Documentado para alineación de gobernanza

---

## 1. Subtipo de Crudo (Tripa Completa vs. Capítulo) y Fecha de Cierre

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | `ingresoServicioSubtipoCrudo` ('Tripa' \| 'Capítulo') y `ingresoFechaCierre`. |
| **Fuente A (Formato Ficha PED-FOR-001)** | El campo aparece visualmente en la primera hoja de "DATOS DE INGRESO", contiguo al "Tipo de proyecto". |
| **Fuente B (Instructivo PED-INS-001 y Regla Negocio #16/#17)** | Instructivo sección Observaciones: *"Para el caso del cuadro con fondo amarillo pastel, ese campo lo debe llenar el equipo de Relaciones Públicas, ya que ellos en su reunión de diagnóstico inicial son los que determinarán si será un CRUDO TRIPA O CRUDO CAPÍTULO. Para el cuadro con fondo azul pastel (Fecha Cierre), se calcula automáticamente en lo que seleccionas el servicio y fecha de ingreso"*. |
| **Implementación actual** | En `server/helpers/preparacionComercial.ts` y `server/routes/trazabilidad.routes.ts`, se prohíbe que el rol `comercial` envíe o modifique `ingresoServicioSubtipoCrudo`. Mientras RRPP no lo complete, el campo es `null` ("Pendiente de RRPP") y la fecha de cierre calculada queda pendiente. |
| **Impacto** | Si Comercial intentara fijar este valor, comprometería un cronograma operativo sin el diagnóstico de páginas y estado del manuscrito que solo RRPP realiza en la reunión inicial. |
| **Decisión de Negocio** | **Confirmada.** Comercial registra solo "Crudo" general. RRPP en su intake inicial define "Crudo - Tripa" o "Crudo - Capítulo", momento en el cual el sistema calcula la Fecha de Cierre Oficial. |

---

## 2. Momento de Activación del Proceso de Soporte Digital (Amazon KDP)

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | Hito de inicio de Soporte Digital (`digitalFechaInicio`, creación de cuenta, envío de formularios). |
| **Fuente A (Manual del Especialista 7.1 y Recordatorios)** | *"Esta activación se realiza en todos los proyectos que se encuentran en Fase 1 o en su primera validación. Solicitud de activación en Amazon: Esta debe hacerse únicamente cuando la tripa esté ya diagramada y se encuentre en su primera validación."* |
| **Fuente B (Concepción Lineal Tradicional)** | Ciertas áreas asumen que Soporte Digital entra solo cuando el libro está completamente diagramado, aprobado y con paquete final cerrado. |
| **Implementación actual** | Existen columnas macro `soporteDigital*` en la ficha, pero no había un disparador de evento claro que generara el work-item en el momento exacto. |
| **Impacto** | Si se espera al paquete final, se generan retrasos de hasta 15 días en la publicación en Amazon mientras el autor llena formularios y se valida la cuenta. Si se activa en Fase 1, corre en paralelo a las rondas de validación. |
| **Decisión de Negocio** | **REGLA OPERATIVA PROVISIONAL:** Modelar como Rama Paralela Activada por Hito, según el Manual del Especialista (Fuente A, la más fuerte y específica disponible). Cuando el diseñador entrega la V1 y entra a Fase 1 de Calidad, el sistema emite automáticamente el work-item y notificación a `soporte_digital` para iniciar trámites de cuenta y acabados de KDP. La carga final de archivos espera al Paquete Final. **El desarrollo no se detiene por esta tensión documental — se avanza con la Fuente A.** **PENDIENTE:** esta discrepancia con la Fuente B (concepción lineal tradicional) no se da por cerrada; si aparece una fuente posterior más específica (ej. en la segunda ronda documental, sección 49 del master prompt de rearquitectura), se revalida con negocio antes de consolidar la regla como definitiva. |

---

## 3. Plazos y Métricas de Sello Editorial (SE)

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | SLA y días de ejecución para Sello Editorial. |
| **Fuente A (Manual del Especialista 1.5)** | Señala *"Sello editorial (3 meses '90 días')"*. |
| **Fuente B (Catálogo Servicios y Seed)** | Registra `plazoInternoDias: 60` y `plazoComercialDias: 90`. |
| **Fuente C (Matriz IA - Objetivos por Mes)** | Se observan objetivos mensuales donde proyectos de SE con Maxwell u otras alianzas tienen plazos máximos asignados de 45 días o 60 días. |
| **Implementación actual** | La tabla `servicios` soporta `plazoInternoDias` y `plazoComercialDias`. |
| **Impacto** | Ponderar la carga o calcular el riesgo con un número fijo (ej. 90 vs 60 vs 45) genera alertas falsas de retraso o sobreestimación de tiempo. |
| **Decisión de Negocio** | Mantener la dualidad (Meta interna de gestión vs. Compromiso comercial del autor). Para alianzas específicas (Maxwell, Karen Hoyos, ILC), permitir que el catálogo de servicios o alianzas sobreescriba el SLA sin hardcodear en componentes React. |

---

## 4. Diferenciación de Roles: Corrector Ortotipográfico vs. Calidad Editorial / Validador

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | Asignaciones, responsabilidades y checklist de corrección vs calidad. |
| **Fuente A (Ficha PED-FOR-001 Pestaña Corrección)** | Evalúa manuscrito en Word (Tripa completa, Preliminares, Cubierta) con un checklist ortotipográfico de 40+ criterios gramaticales. Responsable: Corrector freelance externo contratado por proyecto con plazo de 5 días continuos. |
| **Fuente B (Ficha PED-FOR-001 Pestaña Calidad y Matriz Seguimiento)** | Evalúa el PDF diagramado por Diseño en rondas (Fase 1, Validación V1..Vn, Revisión Final Fase 3, Validación RF V1..Vn). Responsable: Personal interno de control de calidad editorial (ej. Yelitza Hernández, Carolina Acevedo, Luz Llaguno, Yhoiner Parra). |
| **Implementación actual** | En la tabla `proyectos` existía `correctorId`, pero las validaciones de calidad vivían en `fichaCalidadFases` o en la tabla externa `seguimientoFases`. |
| **Impacto** | Mezclar ambos roles causaba confusión operativa entre la corrección del texto antes de maquetar y la validación de maquetación en PDF. |
| **Decisión de Negocio** | Separar estrictamente las entidades y tareas:  
1. *Subpipeline Corrección:* Asignación de Corrector Freelance -> Entrega de Word corregido con control de cambios + informe técnico.  
2. *Subpipeline Calidad / Validación:* Asignación de Validador -> Rondas iterativas sobre el PDF diagramado. |

---

## 5. Circuito de Aprobación de Portadas: Gate de RRPP Previo al Autor

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | Transición de conceptos de portada generados por Líder Creativo. |
| **Fuente A (Manual del Especialista 4.1.2)** | *"El líder creativo entrega de 2 a 3 propuestas. Al recibirlas por correo debemos esperar que sean aprobadas por el equipo de relaciones públicas (Paola Morales). Luego de aprobadas se envían al autor con un plazo de aprobación o feedback de máximo 1 día."* |
| **Fuente B (Flujo directo asumido en UI genéricas)** | En algunas pantallas previas se contemplaba enviar directamente la propuesta de portada al portal del autor sin revisión previa. |
| **Implementación actual** | `PATCH /api/proyectos/:id/propuesta-portada` permitía subir la portada y la exponía de inmediato al autor. |
| **Impacto** | Si se envía un concepto no alineado con la estrategia comercial o de marca al autor, se generan fricciones y reprocesos innecesarios. |
| **Decisión de Negocio** | El sistema debe implementar el gate: Líder Creativo sube conceptos -> RRPP aprueba/valida internamente -> Se publica en el Portal del Autor para elección final. |

---

## 6. Gate de Título y Subtítulo para Reunión Creativa

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | Habilitación de la solicitud y agendamiento de la Reunión Creativa. |
| **Fuente A (Manual 2.3.3 y 4.1)** | *"Antes de diseño: Título y subtítulo deben quedar cerrados. Permite activar reunión creativa. Se solicita solo si hay título definido mediante el formulario."* |
| **Fuente B (Formularios sin validación)** | En interfaces tradicionales, el botón de solicitar reunión creativa permanecía siempre disponible. |
| **Implementación actual** | No existía bloqueo en backend para solicitar reunión creativa sin título. |
| **Impacto** | Realizar una reunión creativa y diseño de portada sin título ni subtítulo aprobados genera conceptos ambiguos que invariablemente deben repetirse. |
| **Decisión de Negocio** | Bloqueo estricto por dependencia (Gate): La acción "Solicitar Reunión Creativa" permanece bloqueada hasta que el proyecto cuente con título y subtítulo definitivos aprobados por el autor y especialista. |

---

## 7. Modelo de Cuotas de Pago (Matriz IA) vs. Solvencia Administrativa

| Dimensión | Detalle |
|---|---|
| **Dato involucrado** | Cuotas 1 a 6 (`pago_cuota_1..6`) y estatus con cobranzas. |
| **Fuente A (Matriz IA)** | Presenta 6 columnas booleanas fijas (Pago Cuota 1 a 6) y un porcentaje de cumplimiento. |
| **Fuente B (Evolución de Pagos y Futuro SSO/JWT)** | Existen clientes con financiamiento en 2 cuotas, 3 cuotas, 4 cuotas o patrocinados (100% becados/institucionales sin cuotas). Requisito #73 estipula que el core editorial no debe acoplarse rígidamente al esquema temporal de 6 cuotas. |
| **Implementación actual** | La tabla `proyectos` tiene columnas `pagoCuota1..6` booleanas, y existe además la tabla `pagos` para abonos específicos. |
| **Impacto** | Forzar exactamente 6 cuotas desvirtúa proyectos con acuerdos de pago de 2 o 3 partes o clientes patrocinados. |
| **Decisión de Negocio** | El core editorial se guía por el hecho operativo de negocio: **Solvencia Administrativa** (`solvente = true / false / patrocinado`) confirmada por Cobranzas para liberar el Paquete Final, permitiendo que la estructura detallada de pagos sea flexible y desacoplada. |
