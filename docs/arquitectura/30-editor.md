# Editor · Inicio / Mi trabajo / Mis proyectos / Mis solicitudes

Fecha: 25 de octubre de 2026. Rol existente: `editor`; área: Edición. Este documento es la contraparte de [docs/arquitectura/29-jefe-edicion.md](./29-jefe-edicion.md): el Jefe de Edición administra (asigna, supervisa, resuelve), el Editor ejecuta. Ambos viven sobre **el mismo dominio** — `work_items`, `project_assignments`, `editorialInterventions()`, `edicionSla.ts` — nunca una segunda matriz paralela.

## Auditoría previa

El rol `editor` ya existía: enum, sesiones, guards, y una implementación mínima (`frontend/src/editor/EditorHomePage.tsx` → `EditorialWorkQueue.tsx`, lista plana sin tabs/filtros/detail panel; backend `GET/PATCH /api/editores/mi-trabajo`, con la entrega limitada a una fecha, sin archivo). Había además `MisTrabajosEdicionPage.tsx`, una pantalla de una fase anterior a `jefe_edicion` (nivel capítulo, vía `GET /api/capitulos/mios`), **no enrutada** desde `HomePage.tsx` — código muerto confirmado por grep antes de tocarlo, eliminado junto con `EditorialWorkQueue.tsx` (reemplazada por este módulo).

Se auditó `server/modules/project-workspaces/templates.ts` (el template real de carpetas Drive por servicio) y `server/modules/integrations/google-drive/adapter.ts`/`oauth.ts` antes de diseñar la entrega e integración documental — ver § Drive abajo. Se auditó `solicitudes_area.tipo` (union cerrado con CHECK en DB) antes de decidir los tipos de solicitud del Editor — ver § Solicitudes abajo.

## Navegación

Sidebar: Inicio / Mi trabajo / Mis proyectos / Mis solicitudes. Mismo shell navy/gold (`CrmSidebarLayout` + `editorialChief.css`, reutilizado tal cual de Jefe de Edición — misma identidad visual, confirmada contra las 4 imágenes de referencia). "Historias que conectan." es únicamente texto de marca en el pie del sidebar: no es `NavLink`, no tiene ruta ni ícono funcional.

El Editor **no ve**: Asignaciones y carga, Seguimiento del equipo, Indicadores del área, Matriz de Editores, administración, ni la gestión de otros Editores — esas pantallas pertenecen a `jefe_edicion` y no se reutilizan ni se exponen con otro nombre.

## Jefe de Edición vs. Editor vs. Especialista vs. Sistema

- **Jefe de Edición**: asigna/reasigna Editor, supervisa carga y vencimientos, resuelve solicitudes.
- **Editor**: inicia trabajo, registra avance (vía fechas/estado del capítulo), registra entrega con archivo real, aplica feedback, reporta bloqueo, solicita apoyo/reasignación/aclaración.
- **Especialista**: coordina con el autor, envía feedback, ve las entregas del Editor.
- **Sistema**: calcula fechas (SLA central, `edicionSla.ts`), deriva estados (`editorialInterventions()`), audita, notifica.

El Editor **no puede**: asignarse trabajo, asignar otro Editor, reasignar, ver la carga completa del equipo, modificar el `assignment`, operar Comercial/RRPP/Dirección Creativa, cerrar trabajo ajeno, ni editar métricas. Reforzado en backend (RBAC + IDOR), nunca solo ocultando botones en el frontend.

## Work item: la unidad operativa

Una fila de Mi trabajo = un work item (capítulo, aplicación de feedback sobre un capítulo, o el contenedor `default` antes de que existan capítulos) — nunca un proyecto. Un mismo proyecto puede tener varias intervenciones en estados distintos simultáneamente (ej. Capítulo 5 esperando autor, Capítulo 6 completado, Capítulo 7 en edición); `editorialInterventions()` (la misma consulta que usa Jefe de Edición, acotada por `editorId`) nunca las colapsa en un estado único.

**Responsabilidad actual ≠ Editor asignado.** `assignedEditor` (quién tiene la intervención, vía `proyectos.editor_id`/`project_assignments`) es distinto de quién tiene la pelota ahora mismo (`waitingOn`). Si `waitingOn='author'` o `'specialist'`, la intervención no es accionable para el Editor y no cuenta como vencida suya — el helper central (`EDITORIAL_RESPONSIBLE` en `editorialChief.ts`) ya resuelve esto; no se reimplementó.

## Backend

- `server/helpers/editorDashboard.ts` — `getEditorDashboard(editorId)`: Inicio. KPIs (pendientes hoy, por vencer, bloqueadas, feedback por aplicar), 6 items de atención priorizados (vencidas → feedback → bloqueadas → en riesgo), próximas entregas, feedback reciente (de `audit_logs`, acotado a proyectos con este Editor), y "Estado de mi trabajo esta semana" (completadas/en curso/por vencer/bloqueadas — conteos reales, nunca un porcentaje inventado).
- `server/helpers/editorWork.ts` — `listarMiTrabajo`/`obtenerDetalleMiTrabajo`: Mi trabajo, con tabs/búsqueda/paginación en memoria sobre el mismo snapshot ya acotado (mismo patrón ya usado y probado en `/editores/intervenciones` de Jefe de Edición — el volumen por Editor es intrínsecamente chico). El detalle resuelve folderKeys de Drive según el tipo real de la intervención, entregas, bloqueo abierto, e historial (capítulos auditan contra el id del CAPÍTULO, no del work item — el detalle resuelve ambos ids para no perder esos eventos).
- `server/helpers/editorialDeliveries.ts` — `registrarEntregaEditorial`/`iniciarTrabajoEditorial`: entrega real con `driveUrl` (persistida en `editorial_deliveries`, metadata-only, mismo patrón que `creative_deliveries` de Dirección Creativa). Capítulos reusan `actualizarCapituloEditor` tal cual (ya resuelve feedback cycle, auditoría y notificación); el resto usa `transicionarWorkItemPorId`.
- `server/helpers/editorialBlockers.ts` — `reportarBloqueoEditorial`/`resolverBloqueoEditorial`: bloqueo explícito, lifecycle propio (`editorial_blockers`: reason/createdBy/createdAt/resolvedBy/resolvedAt/resolution).
- `server/helpers/editorOwnRequests.ts` — `crearRequestEditor`/`listarRequestsEditor`/`obtenerRequestEditorDetalle`/`cancelarRequestEditor`: outbox de solicitudes del Editor.
- Rutas: todas bajo `/api/editores/*` (mismo prefijo que ya usa `GET /editores/carga` de Jefe de Edición), gateadas por `requireRole('editor')` (y `jefe_edicion` además en el resolver de bloqueo, por supervisión).

## Entregas y Drive

**Principio del prompt, verificado contra el código real**: Drive guarda archivos; PanHouse guarda el significado (estado, responsabilidad, deadline, work item, auditoría, entrega, feedback). Nunca se intentó convertir Drive en motor de workflow.

`server/modules/project-workspaces/templates.ts` ya define los folderKeys reales por servicio: `EDITING`, `EDITING_INPUT`/`CONTENT_EXTRACTIONS` (material recibido — EF usa extracciones, el resto usa "Para editar"), `EDITING_OUTPUT` (carpeta de trabajo), `EDITING_FEEDBACK`/`EDITING_FEEDBACK_APPLIED`. El detalle de Mi trabajo solo muestra los folderKeys que corresponden al tipo real de la intervención (capítulo/feedback), tomados de `GET /proyectos/:id/workspace/folders` (metadata persistida, **nunca** una llamada a Drive por fila — cumple la prohibición explícita de N+1 contra Drive). `FULL_MANUSCRIPT_*`/`EDITORIAL_KIT_*` existen en el template pero **no se usan hoy**: se auditó contra datos reales (`work_items` de Edición no-capítulo) y no existe ningún work item de tipo Tripa completa o Kit editorial en el dominio actual — solo `capitulo:*` y el contenedor `default`. No se inventó ese mapeo; queda documentado para cuando ese tipo de intervención exista realmente.

**Por qué no hay un "Explorador de Drive" ni un selector de archivo en vivo**: `GoogleDriveAdapter` (auditado en `adapter.ts`/`provider.ts`) solo expone `listFolders` (filtra `mimeType=folder`), no `listFiles`. Más importante: el OAuth corre bajo scope `drive.file` (`oauth.ts` lo fuerza y **rechaza** cualquier otro scope en `SCOPE_MISMATCH`), que da visibilidad únicamente a archivos que la propia app creó o que el usuario abrió explícitamente con ella — nunca a archivos que un humano arrastra directamente a una carpeta compartida desde su propia cuenta de Drive. El precedente ya existente en este código (`creative_deliveries.driveUrl` obligatorio, `driveFileId` opcional/mejor-esfuerzo) confirma que esta limitación ya se conocía y ya se resolvió de la misma forma: el Editor abre la carpeta de salida (enlace directo, `ProjectWorkspaceCard.tsx` ya usa este mismo patrón — "Abrir ↗" sin explorador), sube el archivo con su propia cuenta, y pega el enlace de PanHouse. `registrarEntregaEditorial` extrae el `driveFileId` del enlace pegado solo como metadata derivada (varios formatos de URL soportados); nunca bloquea una entrega real porque no pudo resolverlo.

**Validación de pertenencia del archivo (prompt §150)**: dado que el scope `drive.file` no garantiza que el backend pueda consultar metadata de un archivo añadido externamente, la verificación real de "pertenece al workspace autorizado" ocurre al nivel de **autorización del work item**, no del archivo: solo el Editor con `proyectos.editor_id = actorId` puede registrar una entrega para ese work item (verificado en cada escritura). Se documenta esto como una limitación conocida y auditada, no como un hueco de seguridad sin resolver.

## Waiting / feedback / bloqueos

- **Esperando autor/Especialista**: deriva de `editorialInterventions()` sin cambios; el Editor nunca ve esa espera como vencida suya ni como accionable.
- **Feedback**: cuando el autor responde, la MISMA intervención (capítulo) vuelve a `Requiere ajustes` automáticamente — no se crea un work item nuevo ni se exige que Jefatura reasigne al mismo Editor.
- **Bloqueo**: `work_items.gate_bloqueante` es un código de gate **sistémico** (solo lectura, ver `gates.ts`) — nunca algo que un humano explique o resuelva. Reportar un bloqueo escribe un motivo legible ahí (reutilizando ese mismo campo libre, tal como fue diseñado) y pone `work_items.estado='bloqueado'`, además de crear una fila en `editorial_blockers` (reason/createdBy/createdAt/resolvedBy/resolvedAt — historial real, único bloqueo abierto por work item vía índice único parcial). Como `'Bloqueadas'` en `editorialChief.ts` deriva directamente de `work_state==='bloqueado'`, el bloqueo aparece automáticamente en Jefe de Edición → Inicio/Asignaciones/Seguimiento/Indicadores, sin tocar esa consulta compartida.
  - **Bug encontrado y corregido durante la implementación**: `sincronizarCapituloEditorial` (la función que resincroniza un capítulo tras cualquier acción normal) no sabía de bloqueos — un cambio normal posterior podía "levantar" el bloqueo por accidente, copiando hacia adelante el estado anterior. Se hizo blocker-aware (revisa si hay un `editorial_blockers` abierto antes de recalcular el estado) y se cubrió con un test que falla sin el fix.
  - **Segundo bug encontrado y corregido**: al resolver un bloqueo, `sincronizarCapituloEditorial` (llamado para recalcular el estado real) leía `work_items.estado` ANTES de que la propia resolución lo limpiara, dejando el estado "fantasma" en `'Bloqueadas'` después de resolver. Se corrigió el orden: limpiar `estado`/`gate_bloqueante` primero, resincronizar después.

## Solicitudes del Editor

`solicitudes_area.tipo` es un union cerrado con CHECK en DB (`'lanzamiento'|'impresion'|'creativa'|'editor'`). **`'editor'` ya tiene una semántica propia**: el Especialista solicita que Jefatura de Edición asigne un Editor (ver 29-jefe-edicion.md § Solicitudes). Las solicitudes que el Editor mismo envía **nunca reutilizan ese valor** — se agregaron tres tipos nuevos, inequívocos: `editor_apoyo`, `editor_reasignacion`, `editor_aclaracion` (migración `0088`, amplía el CHECK; el constraint `solicitudes_area_conversion_valid` ya existente exige `work_item_id`+`requested_by_id` para cualquier tipo que no sea `'creativa'`, así que una solicitud del Editor nunca puede crearse sin contexto real).

`editor_apoyo`/`editor_reasignacion` van a Jefatura de Edición (notificación de rol, mismo mecanismo que ya usa el flujo de asignación existente); `editor_aclaracion` va al Especialista actual del proyecto (`obtenerEspecialistaActual`). El frontend ofrece un selector cerrado de los 3 tipos — nunca un formulario libre que permita inventar tipos; el backend valida igual (`EDITOR_REQUEST_TYPES` + CHECK de DB). Solo el autor de la solicitud puede cancelarla, y solo mientras siga pendiente/en revisión (concurrencia optimista vía `version`, mismo patrón que el resto del dominio). Una segunda solicitud del mismo tipo sobre el mismo work item mientras la primera sigue abierta se rechaza (409).

**Gap conocido y documentado, no resuelto en esta fase**: la bandeja de Solicitudes de Jefatura de Edición (`editorialRequests.ts`) filtra hoy exclusivamente `tipo='editor'` — las tres solicitudes nuevas del Editor NO aparecen todavía en esa lista (sí llega la notificación de rol). Extender esa consulta compartida para incluir los tres tipos nuevos, con una forma de datos distinta (sin "resultado de asignación"/"recomendación"), es un cambio real a una pantalla ya en producción de Jefe de Edición, fuera del alcance de "implementar el rol Editor" — queda como trabajo de seguimiento explícito, no un olvido silencioso.

## Auditoría y notificaciones

Nuevas acciones en el catálogo (`AccionAuditoria`, `server/helpers/auditLog.ts`): `EDITOR_TRABAJO_INICIADO`, `EDITOR_ENTREGA_REGISTRADA`, `EDITOR_BLOQUEO_REPORTADO`, `EDITOR_BLOQUEO_RESUELTO`, `EDITOR_REQUEST_CREADA`, `EDITOR_REQUEST_CANCELADA`, `EDITOR_REQUEST_RESUELTA`. Se agregaron también a `EDITORIAL_EVENTS` (el mismo mapa que ya alimenta "Actividad reciente" de Jefe de Edición) — las acciones del Editor son automáticamente visibles ahí, sin un segundo feed paralelo. Notificaciones: entrega → Especialista actual; bloqueo/apoyo/reasignación → Jefatura de Edición (rol); aclaración → Especialista actual.

## Seguridad

RBAC por rol en cada ruta (`requireRole('editor')`). IDOR: cada escritura (entrega/bloqueo/iniciar/solicitud) revalida `proyectos.editor_id === actor.id` contra el work item real, no contra lo que el cliente afirme — probado explícitamente (Editor A no puede operar sobre work items de Editor B: 403/404 según corresponda). Reasignación: el Editor anterior pierde acceso de escritura inmediatamente (misma verificación, leída en tiempo real); el nuevo Editor lo recibe sin pasos manuales. Idempotencia de entrega: `pg_advisory_xact_lock` sobre el work item + ventana de 5s que reutiliza la entrega ya insertada en vez de duplicarla — doble click no genera dos filas en `editorial_deliveries` (mismo patrón de lock ya usado en `monthlyGoals.ts`, no inventado).

## Evolución del proceso

El diseño se apoya en conceptos estables (Project, Work Item, Assignment, Deliverable, Request, Waiting, Blocker, Audit, FolderKey) en vez de nombres de carpeta o reglas de un Excel específico. `resolveWorkspaceTemplate`/`WORKSPACE_TEMPLATE_VERSION` ya versionan la estructura documental por servicio; este módulo la consume por folderKey (`EDITING_OUTPUT`, etc.), nunca por ruta hardcodeada — si la empresa agrega un tipo de intervención nuevo con su propia carpeta, el único cambio necesario es sumar su folderKey a `folderKeysPara()` en `editorWork.ts`, no reescribir el flujo de entrega.

## Pruebas

`tests/editor.test.ts` (10 tests, todos contra la base real, no mocks): RBAC de las 4 pantallas, asignación → Mi trabajo/Inicio/notificación, entrega con Drive (deliverable real + auditoría + notificación + transición a Esperando Especialista), idempotencia de doble click, espera de autor sin penalizar al Editor, feedback reactivando la intervención, bloqueo (aparece en Jefe de Edición vía el mismo snapshot, entrega bloqueada mientras esté abierto, resolución sin dejarlo "fantasma"), solicitud (creación/duplicado rechazado/notificación/listado/cancelación), IDOR cruzado entre dos Editores, y reasignación (el Editor anterior pierde acceso, el nuevo lo recibe, el historial se conserva).

No se agregaron tests de frontend (`.test.tsx`) nuevos en esta fase: en su lugar se hizo QA visual en vivo con Playwright contra las 4 pantallas reales (datos reales del Editor demo) en 1440×900, 768×1024 y 375×812, con un ciclo real de autocrítica y corrección — ver el reporte de la sesión para el detalle y los hallazgos (incluyendo un bug real de doble TopBar corregido en `AppLayout.tsx`, no cosmético de este módulo sino un gap de exclusión de ruta preexistente que nunca incluyó al rol `editor`).

## Datos demo

Se detectó que los 30 capítulos demo existentes fueron sembrados sin pasar por `crearCapitulo()` (ningún `work_item` materializado — `business_key='capitulo:'||id` sin fila correspondiente). Esto es un artefacto del generador de datos demo, no alcanzable por el dominio real (`crearCapitulo()` siempre sincroniza su work item en la misma transacción). Se corrigió con un script puntual (`scripts/qa-backfill-capitulo-workitems.ts`) que resincroniza cada capítulo existente vía la misma función que el sistema ya usa para autosanar capítulos legacy — no se tocó el generador de datos demo en sí, que queda fuera de alcance de esta fase.
