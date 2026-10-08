# Fase 5D Diseño y diagramación

Fecha: 8 de octubre de 2026. Continuación del checkpoint `ea389f7`.

Se revisaron los cambios de Corrección y Diseño encontrados sin commit antes de modificarlos. El ajuste de 5B agrega `correcciones.entregadoEn` sin eliminar `fechaEntrega`: las nuevas entregas comparan instantes reales contra `dueAt`, incluidos SLA de 12 horas y offsets horarios. Los históricos sin hora conservan su comparación por fecha; no se inventa una hora mediante backfill.

## Fuentes y reglas

Lectura local del Manual del Especialista, §4.2.1–4.2.4 y actualización «Revisión de la cubierta extendida», y de la Ficha de Trazabilidad, hojas «DISEÑO Y DIAGRAMACIÓN», «INS.DISEÑO Y DIAGRAMACIÓN» y condiciones contractuales de «PROYECTO».

- Muestra: al menos los primeros tres capítulos de la tripa enviada a corrección; referencia de tres días para Diseño. Especialista revisa, registra envío al autor, feedback, iteraciones y aprobación.
- Diagramación: tripa corregida del mismo proyecto, evidencia de aprobación de Jefatura de Edición y preparación de créditos, preliminares, destacados y editables aplicables. Consume muestra aprobada y fuentes creativas canónicas.
- Estándar: referencia de cinco días para V1. «Diagramación especial» está estructurada en `condicionesEspeciales`, confirmado en la Ficha; referencia de quince días. No se clasifica desde observaciones libres.
- Cubierta extendida: consume los recursos del concepto aprobado; referencia de tres días. Cada entrega activa una `direccion_creativa` de tipo `revision_cubierta` y una revisión interna separada. La aprobación interna corresponde a `jefe_edicion`, según §4.2.3. Autor recibe la versión después de ambas aprobaciones.
- Muestra y cubierta: referencia de un día para feedback del autor. Se registra el vencimiento exacto pautado; el calendario del Manual aún requiere confirmación.
- Handoff inicial: V1 diagramada y fuente relevante, relacionados por `diseno_versiones` con un work item de Calidad y `ficha_calidad_fases` fase 1. No se deduce una transición de fase por la cantidad de filas legacy.

## Modelo y permisos

`disenos` representa trabajos repeatable de muestra, diagramación o cubierta; `diseno_versiones` registra V1…Vn con entregas inmutables, autor y timestamp, feedback y revisiones por versión. `ficha_diseno_propuestas` continúa representando conceptos creativos, sin duplicarlos como versiones de ejecución. Brief, recursos, títulos y datos del proyecto se leen de sus entidades canónicas.

El especialista propietario solicita, asigna/reasigna y coordina. `proyectos.disenadorId` conserva el responsable actual; `project_assignments` conserva el historial. El diseñador actual ejecuta; otro diseñador, especialista ajeno, editor y corrector no obtienen permisos por conocer IDs. Líder Creativo verifica únicamente su revisión asignada. Jefatura de Edición realiza la revisión interna. Soporte Editorial recibe el handoff.

Las mutaciones bloquean la fila del proyecto dentro de una transacción. Solicitud, entrega, revisiones, assignment y handoff son idempotentes frente a retries concurrentes; claves de entrega/solicitud incompatibles se rechazan. Solo la versión activa admite nuevas acciones. Un rechazo cancela la revisión contraparte que aún no había concluido; V(n+1) tiene revisiones nuevas. El plazo de V1 no se reescribe después de la primera entrega, incluso al reasignar.

Las migraciones 0069 y 0070 son aditivas. La segunda difiere la comprobación de las referencias cruzadas entre hijos del proyecto hasta el final de la transacción, para que el CASCADE no dependa del orden de triggers. No se eliminan campos, tablas ni datos históricos.

## UI

Mis trabajos de Diseño muestra entregables, autor/proyecto, servicio/modalidad, responsable, fuentes canónicas, vencimiento, versión activa, historial y feedback. La sección Diseño del Command Center y de la Ficha utiliza el modelo nuevo; los registros legacy permanecen disponibles para consulta. Las revisiones de cubierta se integran en la bandeja existente del Líder Creativo y la revisión interna en Jefatura de Edición.

## Verificación y pendientes

- Suite completa: 675/675 tests en 41 archivos. Typecheck y build de backend y frontend correctos.
- Verificación HTTP real en servidor local con puerto efímero y base de desarrollo: solicitud, asignación, bandeja, muestra V1/feedback/V2, diagramación, cubierta, revisión creativa/interna y handoff inicial. Limpieza completa de los datos temporales propios confirmada. La primera limpieza detectó el problema de orden de CASCADE; se corrigió en 0070 y se verificó por test y por una nueva corrida HTTP con limpieza exitosa.
- Se comprueban solicitud/gates, asignaciones, ownership/IDOR, muestra, versiones, revisiones por versión, concurrencia, reasignación, handoff con contexto, SLA exacto, audit/notificaciones y CASCADE.
- `TEST_INFRA_FLAKINESS`: el handoff documenta una incidencia anterior de contención del pool, seguida de dos corridas completas de 652/652. No se elimina esa nota ni se interpreta como defecto funcional sin reproducción. En la primera corrida de esta continuación hubo un fallo determinista en el nuevo test de reasignación: intentaba modificar el plazo después de la entrega; se corrigió para verificar la conservación del plazo histórico y la reasignación de forma independiente.
- `PENDIENTE_CONFIRMACION_CALENDARIO_SLA_DISENO`: las fuentes dicen días sin especificar hábiles/continuos. Se conservan referencias de 3/5/15 días y se pauta `dueAt` como timestamp explícito, sin convertir automáticamente días a horas.
- `PENDIENTE_DEFINICION_DIAGRAMACION_ULTRA_ESPECIAL_SLA`: la condición existe, pero no tiene plazo definido en estas fuentes; no se infieren quince días.
- `PENDIENTE_QA_VISUAL`: 375px y 1440px. Solo revisión estática de wrapping, `min-w-0` y columnas que se apilan; no se declara QA visual completado.
- No se modifican SLA históricos de Crudo ni se retira `PENDIENTE_CONFIRMACION_NEGOCIO_CRUDO_TRIPA_SLA`.

Para 5E el usuario confirmó el 8 de octubre de 2026: mantener la bandeja compartida del rol Soporte Editorial; no introducir asignación individual del validador.
