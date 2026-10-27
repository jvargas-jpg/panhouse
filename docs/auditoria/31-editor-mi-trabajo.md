# Editor · Mi trabajo — implementación y validación

27 de octubre de 2026. Alcance: únicamente Editor → Mi trabajo. Referencia utilizada como dirección de composición, sin copiar sus datos. Auditoría inicial: árbol limpio, sin diff, HEAD `0572f2e`; se revisaron los últimos 15 commits antes de implementar.

La bandeja conserva el shell y el logo oficiales. Una fila representa una intervención real; el detalle permite consultar su contexto y ejecutar las acciones autorizadas. No se añadieron datos de muestra al producto, enums de estado, prioridades, porcentajes, selección masiva ni módulos de supervisión.

| Ref. | Punto solicitado | Resultado |
|---|---|---|
| A | Archivo/ruta anterior | `frontend/src/editor/EditorMiTrabajo.tsx`, montado por `EditorHomePage.tsx` en `/?vista=mi-trabajo`; `HomePage.tsx` selecciona este shell para el rol editor. Se evolucionó esa misma pantalla. |
| B | Componentes reutilizados | `CrmSidebarLayout`, `TopBar`, `EditorNav`, `PRODUCTION_LOGO`, `EditorialCover`, `EditorDetail`, `EditorSearch`, `EditorSelect`, `EditorSkeleton`, `EditorEmpty`, `NuevaSolicitudForm`, iconos y tokens existentes. El selector/cargador Drive existente se conserva. |
| C | Legacy descartado | `EditorialWorkQueue` ya no existe en este checkout. No se reactivaron matrices ni edición por fechas de los componentes de proyecto `CommandCenterEdicion`/`SeccionEdicion`. |
| D | Endpoint auditado | `GET /api/editores/mi-trabajo` y `GET /api/editores/mi-trabajo/:id`; comandos existentes para inicio, avance, entrega, bloqueo, resolución y archivos en `server/routes/editor.routes.ts`. |
| E | Cambios backend | Vistas derivadas `pending`/`blocked`; orden validado `priority`/`due`/`project`; actividad reciente por lote con `DISTINCT ON`; historial sin el recorte anterior de ocho eventos, incluyendo asignación/reasignación editorial; texto de SLA desde dominio; fallo de material distinguible de material vacío. Sin migraciones. |
| F | Modelo utilizado | `work_items` de tipo `edicion`, `business_key=capitulo:<id>` cuando corresponde; capítulos canónicos y `project_assignments`. El contenedor `default` no duplica filas cuando hay capítulos. `assignments` no se introdujo como fuente paralela. |
| G | Estados utilizados | `EditorialState`: En edición, Esperando autor, Esperando Especialista, En pausa, Requiere ajustes, Pendiente, Completadas, Bloqueadas. La presentación singulariza badges y deriva Por iniciar/Vencida de señales del servidor. El DTO conserva el estado original. |
| H | waitingOn | Valores existentes `author`, `specialist`, `project_pause`, null. El responsable actual se distingue del editor asignado. Las esperas no ofrecen acciones que el comando de ejecución rechazaría. |
| I | Deadline/SLA | `edicionSla.ts`: tres días hábiles de edición de capítulo y ajuste por pausas; feedback sin SLA inventado. React solo formatea la fecha completa y presenta `overdue`/`waitingOn` ya derivados. |
| J | Row DTO final | `EditorWorkRow = EditorialIntervention + lastActivity:{label,at}\|null`. Conserva IDs de intervención/work item/proyecto/asignación, título, autoría, código, portada, servicio, tipo/label, estado, responsabilidad/espera, inicio, entrega, deadline, riesgo, bloqueo, notas y capacidad de actuar. Respuesta: items, total, pages, page, counts, options y summary preexistente. |
| K | Detail DTO final | `EditorWorkDetail`: item, specialist, assignedAt, folders `{key,label,driveUrl}`, deliveries `{id,driveUrl,observaciones,submittedAt}`, blocker `{id,reason,createdAt,resolvedAt,resolution}`, history `{id,label,actor,at}`; se añaden `materialUnavailable` y `slaLabel`. Definido en `shared/editorOwn.ts`. |
| L | Tabs implementados | Todos, Pendientes, En edición, Feedback por aplicar, Bloqueadas, En espera, Completadas. Se mantiene la vista `today` y su botón contextual para enlaces existentes de Inicio. Conteos calculados en backend sobre el conjunto filtrado completo, antes de paginar. |
| M | Filtros | Panel compacto: estado, tipo de intervención, servicio, proyecto, fecha límite y vencimiento (vencidas/vencen hoy). Estado permite distinguir las esperas reales. Contador de filtros, cierre con Escape/click exterior y limpieza contextual. |
| N | Búsqueda | Servidor: título, autoría, código e intervención/capítulo. Debounce existente de 300 ms. Parámetro y filtros en URL/query key. |
| O | Paginación | Backend, tamaños existentes 10/25/50; rango visible, total y anterior/siguiente. Cambiar filtros o tamaño vuelve a la primera página; navegar página conserva el resto. Prueba con 12 capítulos. |
| P | Ordenamiento | Atención primero usa vencimiento/riesgo/bloqueo/feedback reales; opciones adicionales Vencimiento y Proyecto. Orden estable por ID como desempate. No se crea una prioridad de negocio. |
| Q | Layout tabla | Tabla dominante en escritorio: proyecto/autor, intervención, estado, vencimiento, última actividad y apertura. Portada persistida o placeholder editorial neutral. Sin checkboxes ni cards KPI. |
| R | Selected row | Click o Enter/Espacio seleccionan sin navegar. Fondo cálido sutil y acento dorado; botón real de apertura con nombre accesible. Cerrar deja selección vacía y permite volver a elegir. |
| S | Panel derecho | Master-detail desde 1200 px; drawer en tablet y detalle completo en móvil. Carga por ID seleccionado. Resumen inicial, cierre persistente, Escape, foco visible y bloqueo/restauración del scroll del documento. |
| T | Resumen | Intervención, estado, deadline, responsable actual, siguiente paso y nota real si existe. Contexto desplegable: editor, Especialista, asignación, inicio, plazo aplicable y actividad. El contexto secundario no desplaza la acción principal. |
| U | Material | Solo keys documentales relacionadas con Edición y el tipo de intervención, con enlaces persistidos. No explora todo el Drive. Son carpetas editoriales compartidas del proyecto, no archivos clasificados artificialmente por número de capítulo. Fallo de consulta tiene reintento propio. |
| V | Entregas | `editorial_deliveries` filtradas por workItemId, archivo, fecha y observaciones reales. Vacío explícito cuando no existen. No se muestran entregas de otras intervenciones. |
| W | Feedback | Eventos reales de feedback de la intervención, actor/fecha y acceso a la carpeta autorizada cuando existe. No se inventan comentarios, estados aplicado/pendiente por archivo ni conversaciones. Se eliminó la pérdida de feedback antiguo causada por el límite de ocho eventos. |
| X | Historial | Auditoría de capítulo/work item y eventos de asignación/reasignación editorial del proyecto que determinan su responsable. No incluye eventos generales de otras áreas ni eventos por abrir la pantalla. |
| Y | Acción principal | Iniciar trabajo, Continuar trabajo (abre material), Aplicar feedback (abre entrega del ciclo), Registrar resolución, Ver material o Ver entrega según datos reales. Una sola acción primaria por contexto. |
| Z | Acciones secundarias | Registrar entrega, Reportar bloqueo, Registrar avance y Solicitar apoyo, solo cuando son válidas. Proyecto relacionado como enlace discreto. Solicitar apoyo abre también reasignación/aclaración existentes. |
| AA | Drive integration | Se reutiliza `editorDrive.ts`, integración corporativa y GoogleDriveAdapter; IDs persistidos y autorización de proyecto. Lista/detalle no llaman a Google. La prueba de nube real no se ejecutó: el entorno local QA no tiene un workspace Drive conectado; los tests de integración sustituyen únicamente el transporte de Google. |
| AB | Folder keys | EF: CONTENT_EXTRACTIONS; otros capítulos: EDITING_INPUT. Además EDITING_OUTPUT, EDITING_FEEDBACK, EDITING_FEEDBACK_APPLIED. Fallback existente EDITING para intervención genérica. No se crearon keys Tripa/Kit sin work items equivalentes reales. |
| AC | Delivery implementation | Comando moderno existente `registrarEntregaEditorial`: workItemId, projectId, driveFileId, driveUrl, submittedBy, submittedAt y observaciones en `editorial_deliveries`; transición, auditoría y aviso en la misma transacción. Idempotencia por ciclo con bloqueo de proyecto/work item. |
| AD | Drive file validation | Backend analiza URL, rechaza dominios ajenos, carpetas/shortcuts y archivos fuera del workspace; comprueba conexión y ascendencia. Revalida asignación/estado transaccionalmente tras consultar Google. Selector autoriza folderKey. Tests cubren archivos ajenos/inaccesibles y reasignación concurrente. |
| AE | Blocker flow | Modal compacto con motivo obligatorio, persistencia y auditoría; resolución explícita. Probado desde UI contra API/PostgreSQL reales del entorno aislado, y contra Seguimiento en tests. No crea solicitudes automáticamente. |
| AF | Support request | Formulario contextual reutilizado, work item obligatorio, destinatario del dominio, duplicados rechazados. Creación desde UI y comprobación del workItemId/destino por API; la solicitud temporal de QA se cancela después. |
| AG | Reassignment request | Tipo `editor_reasignacion` disponible dentro del mismo modal. El editor solo solicita. Jefatura conserva el comando de asignación. Tests verifican cambio canónico, revocación del editor anterior y continuidad del historial. |
| AH | Audit | Se conservan los comandos/eventos existentes de inicio, avance, entrega, feedback, bloqueo/resolución y solicitudes. El historial ahora incorpora también `EDITOR_ASIGNADO`/`EDITOR_REASIGNADO`. |
| AI | Notifications | Se conserva emisión existente para entrega al Especialista, bloqueo a Jefatura y decisiones al Editor. Tests verifican notificación contextual y ausencia de duplicación de entrega. No se cambia el sistema global. |
| AJ | TanStack invalidation | Keys de lista con todos los filtros/orden/tamaño/página; detalle por ID; selector de archivos por ID/carpeta/token. Tras acciones se invalidan Editor, Jefatura, notificaciones y fuentes relacionadas existentes. Sin recargar la ventana. |
| AK | RBAC | Guards `requireAuth`/`requireRole('editor')` y ownership en comandos/consultas. Ninguna capacidad nueva para asignar, reasignar directamente o gestionar equipos. |
| AL | IDOR | Pruebas explícitas de detalle, inicio, entrega, bloqueo, archivos y proyecto ajenos; proyecto ajeno no aparece al filtrar. Leer/cancelar requestId de otro editor se rechaza. Las entregas solo se exponen desde el detalle autorizado, no mediante un endpoint libre por deliveryId. |
| AM | N+1 audit | Lista: una consulta de intervenciones y una consulta de última actividad por lote de IDs visibles; cero llamadas Drive. El detalle consulta únicamente la intervención elegida. No se agrega una consulta por fila. |
| AN | Performance | Se mantiene el patrón existente de filtro/orden/paginación en memoria en servidor, sobre la carga personal acotada del editor. `DISTINCT ON` evita transferir todo el historial por cada fila. El historial completo se carga solo para la selección; no se realizó benchmark masivo ni se afirma paginación SQL. |
| AO | Tests nuevos/modificados | Dos nuevos casos backend: conteos antes de paginar/filtros/orden y conservación de feedback tras nueve avances. Refuerzo de IDOR e historial de reasignación. Dos nuevos casos frontend: espera sin acciones inválidas y fallo de detalle independiente. Test de tabla actualizado. Script QA específico nuevo. |
| AP | Tests ejecutados | 10 archivos: tests/editor.test.ts, editores.routes.test.ts, editorialAssignments.test.ts, editorialRequests.test.ts, editorialRequests.lifecycle.test.ts, editorialTracking.test.ts; frontend Editor y vistas compartidas de Asignaciones, Solicitudes y Seguimiento. Resultado en [final-tests.json](../evidencias/editor-mi-trabajo/final-tests.json). |
| AQ | Resultados | 122/122 pruebas pasaron, cero fallos. QA real de navegador sin errores JavaScript ni overflow horizontal; acciones de inicio/avance/bloqueo/resolución/solicitud persistidas. Evidencia en [qa.json](../evidencias/editor-mi-trabajo/qa.json). |
| AR | Typecheck | Backend `npm run typecheck`: correcto. Frontend `npm --prefix frontend run typecheck`: correcto. |
| AS | Builds | Backend `npm run build`: correcto. Frontend `npm --prefix frontend run build`: correcto. Vite mantiene el aviso del bundle global mayor de 500 kB; no se amplió esta tarea a su división. |
| AT | QA 1440 | Vista real 1440×900, login Editor QA existente; tabla de 794 px, detalle de 350 px, controles sin overflow y acción principal visible sin desplazar el detalle. [Captura](../evidencias/editor-mi-trabajo/desktop.png). |
| AU | QA 768 | Vista real 768×1024; tabla de 724 px, filtros reordenados, detalle en drawer accesible. Apertura, cambio de sección, Escape y restauración de scroll probados. [Lista](../evidencias/editor-mi-trabajo/tablet.png), [detalle](../evidencias/editor-mi-trabajo/tablet-detail.png). |
| AV | QA 375 | Vista real 375×812; lista de 351 px, tabs envueltos, filtros dentro del viewport, detalle completo y modal anidado sin cerrar accidentalmente el detalle. [Lista](../evidencias/editor-mi-trabajo/mobile.png), [detalle](../evidencias/editor-mi-trabajo/mobile-detail.png), [bloqueo](../evidencias/editor-mi-trabajo/mobile-blocker-dialog.png). |
| AW | Correcciones tras mirar capturas | Filas más compactas; código repetitivo eliminado de cada fila y conservado en detalle; chevron sin recorte; fecha con año; cierre integrado en cabecera; acciones antes del contexto desplegable; selección dorada discreta. El test de Tab detectó salida de foco del modal: se corrigió y se repitió la prueba. |
| AX | Archivos tocados | Frontend: EditorMiTrabajo.tsx, EditorUi.tsx, editor.test.tsx, nuevo miTrabajo.css. Backend: editorWork.ts, editor.routes.ts. Compartido: editorOwn.ts. Tests: tests/editor.test.ts. Nuevo scripts/editor-mi-trabajo-qa.mjs, este informe y docs/evidencias/editor-mi-trabajo/. No se editaron Inicio, Mis proyectos ni Mis solicitudes. |
| AY | git diff --stat | 7 archivos tracked, 242 inserciones, 99 eliminaciones. Detalle literal debajo; los archivos nuevos aún untracked se enumeran en AZ. |
| AZ | git status | Cambios sin commit, siete archivos modificados y cuatro rutas nuevas (informe, evidencias, CSS y script), detallados debajo. El árbol estaba limpio al empezar. |

```text
frontend/src/editor/EditorMiTrabajo.tsx | 234 +++++++++++++++++++++-----------
frontend/src/editor/EditorUi.tsx        |  12 +-
frontend/src/editor/editor.test.tsx     |  19 ++-
server/helpers/editorWork.ts            |  30 ++--
server/routes/editor.routes.ts          |   2 +-
shared/editorOwn.ts                     |   1 +
tests/editor.test.ts                    |  43 ++++++
7 files changed, 242 insertions(+), 99 deletions(-)
```

```text
 M frontend/src/editor/EditorMiTrabajo.tsx
 M frontend/src/editor/EditorUi.tsx
 M frontend/src/editor/editor.test.tsx
 M server/helpers/editorWork.ts
 M server/routes/editor.routes.ts
 M shared/editorOwn.ts
 M tests/editor.test.ts
?? docs/auditoria/31-editor-mi-trabajo.md
?? docs/evidencias/editor-mi-trabajo/
?? frontend/src/editor/miTrabajo.css
?? scripts/editor-mi-trabajo-qa.mjs
```

La previsualización local de QA usa `http://127.0.0.1:5176/?vista=mi-trabajo`, con API en 3009 y base aislada `panhouse_editor_preview_20261026`; no modifica los datos de desarrollo. El script de capturas se reproduce con `PANHOUSE_PLAYWRIGHT_MODULE` apuntando a la instalación local de Playwright cuando no está disponible por nombre. Todas las capturas usan la aplicación y datos persistidos de QA; ningún dato de la imagen de referencia fue incorporado a la pantalla.
