# Editor · Mis solicitudes — implementación y validación

Fecha: 27 de octubre de 2026. Alcance de esta iteración: exclusivamente Editor → Mis solicitudes. Los cambios previos sin commit de Mi trabajo y Mis proyectos se conservaron. Se inspeccionaron `git status`, `git diff --stat`, `git diff` y los últimos 15 commits antes de implementar.

La imagen se utilizó como dirección de composición, densidad y jerarquía. La aplicación mantiene el shell, la navegación y el logo oficial existentes. Las capturas y los datos de prueba pertenecen a una base local aislada; no se añadieron solicitudes ni archivos de ejemplo a desarrollo.

| Punto | Tema | Resultado y evidencia |
|---|---|---|
| A | Ruta anterior | Se conserva `/?vista=mis-solicitudes`; selección mediante `request=<uuid>`. Componente `frontend/src/editor/EditorMisSolicitudes.tsx`. |
| B | Componentes existentes | EditorMisSolicitudes, NuevaSolicitudForm, EditorDetail, EditorSearch, EditorSelect, EditorSkeleton y EditorStatus; API editorApi; helper editorOwnRequests; inbox EditorialRequests de Jefatura. Se reutilizan las primitivas visuales y los comandos del dominio. El formulario compartido de Mi trabajo permanece intacto. |
| C | Schema | `solicitudes_area`: id, proyecto_id, work_item_id, tipo, business_key, requested_by_id, target_user_id, descripcion, estado, requested_at, resolved_at, resolved_by_id, outcome, motivo y version. `informacion_solicitud_area`: pregunta, autor/fecha de pregunta y respuesta, actor/fecha de respuesta. Auditoría y notificaciones existentes. No hay tabla nueva ni migración nueva. |
| D | Unión de tipos | `lanzamiento`, `impresion`, `creativa`, `editor`, `editor_apoyo`, `editor_reasignacion`, `editor_aclaracion`. Los últimos tres ya existían antes de esta iteración. |
| E | Semántica de editor | `tipo='editor'` sigue siendo la petición del Especialista para que Jefatura asigne Editor. No se acepta en la creación de solicitudes propias del Editor. |
| F | Tipos nuevos | Ninguno. Bloqueos ya tienen entidad y comando propios; no se duplican como solicitud. No hay necesidad documentada ni infraestructura de request formal de material. |
| G | Separación semántica | La outbox filtra exclusivamente los tres tipos propios y `requested_by_id` de la sesión. El tipo nativo editor no se reutiliza. |
| H | Lifecycle encontrado | pendiente, en_revision, requiere_informacion, resuelta, rechazada y cancelada. `en_revision` tiene comando explícito review; consultar una solicitud no modifica su estado. |
| I | Lifecycle final | Se conserva el lifecycle. La presentación llama Devuelta a requiere_informacion. Rechazada se conserva como estado real de lectura; no se transforma en una resolución positiva. La pestaña Rechazadas aparece solo si hay datos o se solicita en URL. |
| J | Creación por actor | Solo rol editor autenticado, sobre una intervención editorial propia y vigente. No puede crear una solicitud genérica, resolverla, asignar otro Editor ni escoger destinatario. |
| K | Destinos | Apoyo y reasignación → Jefe de Edición; aclaración → Especialista actual del proyecto. El backend resuelve y valida el destinatario. |
| L | Reglas de creación | Motivo de 5–1000 caracteres; UUID de work item válido; proyecto activo; asignación canónica vigente; trabajo no completado ni cancelado; aclaración exige Especialista. Body estricto rechaza destinatarios, estados o adjuntos arbitrarios. |
| M | Edición | No se edita el texto original de una solicitud pendiente. Una devuelta admite completar información mediante la pregunta pendiente, manteniendo el mismo ID y la descripción original. Resuelta, rechazada y cancelada son de lectura. |
| N | Cancelación | El creador puede cancelar pendiente o en_revision con expectedVersion. Confirmación mediante dialog nativo, historial conservado, resolvedAt/resolvedById registran actor y fecha de retirada y se incrementa version. No hay DELETE. |
| O | Resolución | Los roles receptores conservan su decisión existente. Una reasignación no puede resolverse hasta que exista una asignación canónica posterior al envío a otro Editor. Esta iteración no rediseña la UI de Jefatura ni del Especialista. |
| P | Row DTO | Identidad de solicitud, tipo, proyecto/código, autoría, portada aprobada o fallback, work item/intervención, motivo, estado, destino, creador, envío, updatedAt y lastEventLabel. La lista no carga respuestas ni historial completo por fila. |
| Q | Detail DTO | Summary, descripción original, preguntas/respuestas con actores/fechas, historial y referencias del resultado. Carga independiente al seleccionar. workAccessible y canRespond controlan los enlaces y el reenvío. |
| R | Pestañas | Todas, Pendientes, Devueltas, Resueltas y Canceladas; Rechazadas condicional según datos reales. Pendientes agrupa pendiente y en_revision; cada fila conserva su estado textual específico. Detail: Detalle, Respuestas cuando existen preguntas persistidas, Historial. |
| S | Conteos | Backend calcula los conteos sobre todas las solicitudes que cumplen los filtros, antes de filtrar por pestaña y paginar; no usa solo los elementos visibles de la página. |
| T | Filtros | Tipo, proyecto, destino y rango de fecha de envío, dentro de Filtros. Opciones de proyecto solo de la outbox propia. Rango inválido devuelve 400. Limpiar filtros mantiene la pestaña y elimina filtros/selección/página. |
| U | Búsqueda | Debounce de 300 ms, búsqueda en servidor por proyecto, código, autoría, intervención, motivo y etiquetas reales de tipo. No hay consulta de Google. |
| V | Paginación | Servidor devuelve total, page y pages con página acotada. Tamaños 10/25/50; se conservan en URL. El patrón existente carga el conjunto personal y filtra/pagina en backend; no se afirma LIMIT/OFFSET SQL ni un benchmark de grandes volúmenes. |
| W | Orden | Por defecto devueltas primero, pendientes/en revisión después y solicitudes cerradas al final; fecha de envío e ID desempatan. Alternativas: más recientes o última actualización real. Cambiar filtro/orden/tamaño reinicia la página. |
| X | Selección | Una fila = una solicitud propia. Click, Enter o Espacio seleccionan sin abandonar la pantalla; botón con nombre accesible y estado de selección. URL conserva request y detailTab. Auto-selección de la primera fila solo en escritorio; se puede cerrar el panel. |
| Y | Detail | Tipo, estado, envío, proyecto, intervención, autoría, motivo, creador, destino, última actividad y resultado. Lista dominante y panel blanco con borde discreto, sin KPI. Carga/error/reintento independientes. |
| Z | Conversación/comentarios | No hay comentarios independientes de request ni chat en tiempo real. Se usa Respuestas para las preguntas y respuestas ya persistidas en informacion_solicitud_area. No se crean comments, websockets ni estados de lectura artificiales. |
| AA | Adjuntos | No existe relación canónica entre solicitud y archivo ni endpoints de adjuntos de solicitud. Se omiten pestaña Archivos, upload y descargas. No se ofrece el Drive completo ni un vínculo falso. |
| AB | Historial | Timeline de audit_logs limitado al entity_id y entity_type solicitud, con actor y fecha. Se eliminó el truncado anterior de 20 eventos. La última actualización de la lista deriva del último evento y del cierre, sin N consultas por fila. Lectura no genera auditoría. |
| AC | Result references | projectId, workItemId, assignmentId y resolvedById reales. Las nuevas resoluciones de reasignación auditan assignmentId; la proyección prioriza esa referencia. Para historial anterior sin esa referencia se mantiene fallback de asignación acotado entre envío y resolución, sin atribuir una asignación posterior al cierre. |
| AD | Flujo de creación | Nueva solicitud abre un formulario compacto: tipo, destino calculado, proyecto, intervención y motivo. Selección de intervención paginada cuando procede. Enviar exige contexto y queda deshabilitado durante envío. Al crear, abre el detalle del ID devuelto. La creación desde Mi trabajo existente se conserva. |
| AE | Devuelta | Motivo de devolución visible y CTA Completar información. Formulario enfoca el textarea. Responder y reenviar actualiza la pregunta pendiente, conserva el request y vuelve a pendiente. Historial y respuesta con actores/fechas permanecen consultables. Se revalida asignación y estado de la intervención dentro de la transacción. |
| AF | Resuelta | Bloque Resultado con texto persistido, actor y fecha; reasignación muestra Editores anterior/nuevo y fecha de asignación. Sin botones para resolver, editar ni completar solicitudes cerradas. El enlace a Mi trabajo solo aparece si el trabajo sigue accesible al creador. |
| AG | Cancelada | Dialog de confirmación con Volver y Confirmar cancelación; Escape cancela el dialog y mantiene el panel abierto. Tras retirar, se muestra el estado y se conserva la historia. No desaparece físicamente la fila. |
| AH | Duplicados | La comprobación de solicitud abierta equivalente incluye requester, work item y tipo. Se serializa mediante el bloqueo del proyecto y work item; solicitudes de un Editor anterior no bloquean indebidamente al nuevo responsable. |
| AI | Idempotencia | Ref sincrónica y botón deshabilitado evitan doble envío en frontend. Dos POST concurrentes crean una sola solicitud: el segundo recibe 409. Tras cerrar una solicitud puede existir una nueva decisión contextual; no se reutiliza un ID cerrado. |
| AJ | Concurrencia | expectedVersion y bloqueo transaccional de solicitud. Reenvío bloquea proyecto/work antes de solicitud y revalida ownership. Ante 409 la UI muestra un mensaje comprensible y refresca datos; ante pérdida de asignación informa y vuelve a cargar el detalle. QA verifica resolución por Jefatura mientras el Editor tiene la cancelación abierta. |
| AK | Notificaciones | Se reutilizan los avisos del dominio: creación al destinatario real; devolución/revisión/resolución al Editor; reenvío al receptor. Deep links existentes `/?vista=mis-solicitudes&request=<id>`. Abrir no notifica ni añade badge histórico. |
| AL | Auditoría | CREADA, EN_REVISION explícita, DEVUELTA, REENVIADA, RESUELTA y CANCELADA. Se conservan actor, entidad, proyecto y detalles. La resolución de reasignación añade la referencia de asignación ejecutada. |
| AM | RBAC | Sesión y rol editor en outbox y comandos propios. Decidir exige receptor autorizado; aclaración solo Especialista actual, apoyo/reasignación Jefatura. Editor no decide ni accede a la carga global del equipo. |
| AN | IDOR | Otro Editor no enumera, obtiene detalle, cancela ni responde solicitudes ajenas. No puede crear sobre work item ajeno. El creador conserva lectura histórica tras reasignación y pierde operación sobre el trabajo. Tests 403/404 en API y QA de navegador. |
| AO | Seguridad de archivos | No hay superficie de adjuntos creada. Body con fileId/attachment arbitrario se rechaza por esquema estricto y la ruta de adjunto inexistente devuelve 404. No se trata un archivo de entrega de Mi trabajo como un adjunto de solicitud. |
| AP | Performance/N+1 | Lista: una consulta SQL con joins y laterales para contexto y último evento, sin ida/vuelta por fila ni llamadas a Drive. Detail: tres consultas acotadas a la solicitud seleccionada (summary, respuestas y eventos). Respuestas/historial no se precargan en cada fila. No se hizo benchmark masivo. |
| AQ | Tests | 153/153 pruebas aprobadas en 11 archivos: requests Editor (11 nuevos), interfaz requests (10 nuevos), Editor existente, portafolio, lifecycle de Jefatura, solicitudes/asignaciones de Jefatura y solicitudes del Especialista. [Resultado completo](../evidencias/editor-mis-solicitudes/final-tests.json). Navegador: 8 comprobaciones completas y cero errores JavaScript. [QA](../evidencias/editor-mis-solicitudes/visual-qa.json). |
| AR | Typecheck | Backend `npm run typecheck` y frontend `npm --prefix frontend run typecheck`: correctos. |
| AS | Builds | Backend `npm run build` y frontend `npm --prefix frontend run build`: correctos. Permanece el aviso previo del bundle global mayor de 500 kB; esta tarea no amplía el alcance a dividir el bundle de toda la aplicación. |
| AT | QA 1440 | 1440×900, filas observadas de 73 px, lista dominante y panel de 380 px con CTA visible. [Lista y detalle](../evidencias/editor-mis-solicitudes/desktop.png), [respuestas](../evidencias/editor-mis-solicitudes/desktop-responses.png), [creación](../evidencias/editor-mis-solicitudes/desktop-create.png), [confirmación](../evidencias/editor-mis-solicitudes/desktop-cancel-confirm.png), [conflicto resuelto](../evidencias/editor-mis-solicitudes/desktop-stale-resolved.png). |
| AU | QA 768 | 768×1024; lista a ancho completo, drawer accesible con CTA visible, cambio a historial, Escape y restauración del foco/scroll. [Lista](../evidencias/editor-mis-solicitudes/tablet.png), [detalle](../evidencias/editor-mis-solicitudes/tablet-detail.png). |
| AV | QA 375 | 375×812; lista de solicitudes de 173–174 px por elemento, detalle a pantalla completa, acciones visibles abajo, sin overflow horizontal. [Lista](../evidencias/editor-mis-solicitudes/mobile.png), [detalle](../evidencias/editor-mis-solicitudes/mobile-detail.png), [historial](../evidencias/editor-mis-solicitudes/mobile-history.png). |
| AW | Correcciones de QA | Nombres accesibles explícitos en los selectores del formulario, Escape del dialog no cierra el panel, mensaje comprensible al recibir 409 con refresco del resultado, fuente de filas de escritorio ampliada y filas móviles reducidas de ~211 a ~174 px. Se inspeccionaron las capturas finales de escritorio y móvil. |
| AX | Archivos de esta iteración | EditorMisSolicitudes.tsx; misSolicitudes.css; EditorHomePage.tsx (solo subtítulo de esta pantalla); editor.test.tsx (label del caso de solicitudes); nuevo editorRequests.test.tsx; editorOwnRequests.ts; editor.routes.ts (filtros y body de solicitudes); shared/editorOwn.ts (DTO); nuevo tests/editorRequests.test.ts; tres scripts de QA de solicitudes; este informe y evidencias. |
| AY | git diff --stat | Estado combinado con tareas anteriores: 12 archivos tracked, 568 inserciones y 255 eliminaciones. No representa exclusivamente esta pantalla. Los archivos nuevos sin seguimiento se detallan en git status debajo. No se creó commit. |
| AZ | git status | Árbol con cambios previos conservados y archivos de esta pantalla añadidos. `git diff --check` correcto. Estado literal debajo. |

En el entorno real de desarrollo se abrió la pestaña existente de Chrome en `http://localhost:5173/?vista=mis-solicitudes`: lista vacía válida, cero solicitudes propias y sin error. Se abrió Nueva solicitud y se comprobó que carga sus 20 proyectos actuales y los tres tipos permitidos; Enviar permanece deshabilitado sin intervención. Se cerró el formulario sin enviar ni modificar datos. No se aplicó una migración adicional: esta implementación utiliza el schema vigente, ya actualizado en la corrección anterior.

La prueba funcional con creación/devolución/resolución/cancelación se ejecutó únicamente en `panhouse_editor_preview_20261026`, con API `3010` y frontend `5177`. Los scripts comprueban host local y fijan esa base antes de importar la aplicación. Las únicas respuestas interceptadas fueron el fallo temporal de detalle para comprobar su reintento; las listas, las solicitudes, sus decisiones y sus historiales se obtuvieron de la aplicación real y PostgreSQL.

```text
 frontend/src/editor/EditorHomePage.tsx       |   2 +-
 frontend/src/editor/EditorMiTrabajo.tsx      | 234 +++++++++++++++++----------
 frontend/src/editor/EditorMisProyectos.tsx   | 157 ++++++++++++------
 frontend/src/editor/EditorMisSolicitudes.tsx | 220 +++++++++++++++++--------
 frontend/src/editor/EditorUi.tsx             |  12 +-
 frontend/src/editor/editor.test.tsx          |  31 +++-
 frontend/src/editor/editorApi.ts             |   6 +-
 server/helpers/editorOwnRequests.ts          |  56 +++++--
 server/helpers/editorWork.ts                 |  30 ++--
 server/routes/editor.routes.ts               |  21 +--
 shared/editorOwn.ts                          |  11 +-
 tests/editor.test.ts                         |  43 +++++
 12 files changed, 568 insertions(+), 255 deletions(-)
```

```text
 M frontend/src/editor/EditorHomePage.tsx
 M frontend/src/editor/EditorMiTrabajo.tsx
 M frontend/src/editor/EditorMisProyectos.tsx
 M frontend/src/editor/EditorMisSolicitudes.tsx
 M frontend/src/editor/EditorUi.tsx
 M frontend/src/editor/editor.test.tsx
 M frontend/src/editor/editorApi.ts
 M server/helpers/editorOwnRequests.ts
 M server/helpers/editorWork.ts
 M server/routes/editor.routes.ts
 M shared/editorOwn.ts
 M tests/editor.test.ts
?? docs/auditoria/31-editor-mi-trabajo.md
?? docs/auditoria/32-editor-mis-proyectos.md
?? docs/auditoria/33-editor-mis-solicitudes.md
?? docs/evidencias/editor-mi-trabajo/
?? docs/evidencias/editor-mis-proyectos/
?? docs/evidencias/editor-mis-solicitudes/
?? frontend/src/editor/editorProjects.test.tsx
?? frontend/src/editor/editorRequests.test.tsx
?? frontend/src/editor/miTrabajo.css
?? frontend/src/editor/misProyectos.css
?? frontend/src/editor/misSolicitudes.css
?? scripts/editor-mi-trabajo-qa.mjs
?? scripts/editor-projects-qa-seed.ts
?? scripts/editor-projects-visual-qa.mjs
?? scripts/editor-requests-qa-seed.ts
?? scripts/editor-requests-qa-server.ts
?? scripts/editor-requests-visual-qa.mjs
?? server/helpers/editorProjects.ts
?? shared/editorProjects.ts
?? tests/editorProjects.test.ts
?? tests/editorRequests.test.ts
```
