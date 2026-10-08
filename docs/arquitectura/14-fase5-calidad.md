# Fase 5E Calidad y validación

Fecha: 8 de octubre de 2026. Continuación después de `247c4f7` (5D).

Calidad utiliza las filas existentes de `ficha_calidad_fases` y su unicidad por ficha, fase y ronda. No hay otra arquitectura de rondas. El usuario confirmó mantener una bandeja compartida de `soporte_editorial`; no se crea asignación individual de validador. Se registra quién efectivamente revisó mediante `revisadoPorId` y `nombreQuienRecibe`, como hecho histórico.

## Fuentes y transiciones

Manual del Especialista §5.1–5.6 y §6.1; Ficha de Trazabilidad, hojas «CALIDAD EDITORIAL» e «INS.CALIDAD EDITORIAL». Las instrucciones de la Ficha confirman las fases 1, 2.x, 3 y 4.x, los contadores, el checklist y el responsable real de cada revisión.

1. Diseño entrega la diagramación inicial a F1, con versión y tripa fuente.
2. Soporte Editorial inicia/revisa. F1/F3 incorporan los criterios de la Ficha; se registra cumplimiento, observaciones o No aplica en los criterios pertinentes. Rechazar requiere PDF comentado y total de comentarios.
3. Una devolución abre el mismo trabajo de Diseño para V(n+1). Conserva la entrega anterior, su PDF comentado y la ronda anterior. La siguiente entrega se deriva a F2.x, o F4.x si proviene de revisión final. La fase se deriva de la ronda operativa del mismo trabajo, nunca de la cantidad de registros legacy.
4. En F2/F4 se valida cantidad de cambios por verificar, pendientes y nuevos; total de comentarios pendientes = pendientes + nuevos. Aprobar exige cero comentarios pendientes. Las rondas pueden repetirse sin límite artificial.
5. Especialista propietario registra envío al autor solo después de aprobación de F1/F2. Un feedback del autor requiere PDF marcado y total; vuelve a Diseño y luego a F2, conservando el origen de los comentarios.
6. La aprobación del autor permite solicitar F3, con enlace a números legales de RRPP si están disponibles. La revisión verifica su incorporación o devuelve los comentarios correspondientes, conforme al Manual. No se generan números legales ni se cambia la responsabilidad de RRPP.
7. F3 puede aprobar directamente o devolver comentarios y continuar por F4.x. El output de tripa queda validado al aprobar la revisión final. El estado para solicitar paquete final requiere además la cubierta más reciente con aprobación creativa, interna y del autor; una cubierta nueva pendiente mantiene cerrado ese gate.

## Datos e integridad

La migración 0071 agrega vínculos de las rondas a work items y versiones, timestamps, reviewer real, checklist JSON, PDF comentado, total y observaciones. Los contadores de validación ya existentes se reutilizan. `diseno_versiones.feedbackArchivoUrl` conserva el enlace estructurado del PDF comentado de Calidad o del autor.

El backfill conecta únicamente handoffs realmente registrados por 5D, mediante `calidadFaseId`, `calidadWorkItemId` y `handoffEn`; no inventa revisiones, resultados, horarios ni responsables para las filas legacy. Las referencias cruzadas entre ronda y versión se comprueban al cerrar la transacción, manteniendo el CASCADE del proyecto. No se eliminan tablas, columnas ni datos históricos.

Todas las acciones bloquean el proyecto dentro de una transacción, compartiendo la exclusión con Diseño. Retrys concurrentes no duplican ronda final, work item, audit ni notificación. Cambiar un resultado registrado produce conflicto; actuar sobre otra versión o una ronda histórica se rechaza. Las rutas legacy de actualización/borrado no pueden modificar rondas operativas.

## UI y roles

Bandeja de Calidad para Soporte Editorial: trabajo activo, PDF, fuente, versión anterior/PDF comentado anterior, vencimiento, checklist, contadores, revisión y resultado. Las rondas anteriores permanecen consultables.

La sección de Calidad del Command Center/Ficha incorpora coordinación del especialista propietario, feedback del autor, aprobación y solicitud de revisión final. Diseñador y Jefatura de Área tienen lectura según el modelo aprobado; el diseñador aplica comentarios desde su bandeja de Diseño. Corrector, Editor y Líder Creativo no reciben permisos de revisión de Calidad.

Como dependencia de seguridad, la asignación 5C de una `revision_cubierta` no permite que un líder se apropie de la revisión de otro ni que reabra una revisión resuelta/cancelada. El workflow de conceptos de portada de 5C conserva su comportamiento.

## Verificación y pendientes

- Suite completa: 690/690 tests en 42 archivos. Typecheck y build correctos de backend y frontend. Drizzle confirma que schema y snapshot coinciden, sin cambios pendientes de generar.
- Tests de F1/F2.x/Autor/F3/F4.x, seis rondas de F2, checklist, contadores, referencias canónicas, bandeja compartida, reviewer real, timestamp/SLA, concurrencia, ownership/IDOR, bypass por rutas legacy, gate de cubierta actual y CASCADE.
- Verificación HTTP real de 5D+5E en servidor local y base de desarrollo: muestra, diagramación V1/V2/V3/V4, F1, F2.1, feedback del autor, F2.2, F3, F4.1, cubierta, ambas revisiones, aprobación del autor y gate de paquete final. Datos temporales propios eliminados completamente.
- `PENDIENTE_CONFIRMACION_CALENDARIO_SLA_CALIDAD`: §5.1 indica máximo un día para F1, sin definir hábiles/continuos. Se conserva la referencia y se pauta un timestamp exacto explícito. No se asignan plazos a F2/F3/F4 sin respaldo de una fuente.
- `PENDIENTE_QA_VISUAL`: 375px y 1440px. Typecheck/build y revisión estática de responsive no equivalen a QA visual.
- Se conserva `TEST_INFRA_FLAKINESS`, documentado en el checkpoint de 5D; no se amplían pruebas repetidamente por esa incidencia histórica sin reproducción.
- El paquete final y Soporte Digital corresponden a las fases posteriores; 5E deja el output validado y su contexto disponibles.
