# Editor · Mis proyectos — implementación y validación

27 de octubre de 2026. Alcance de esta iteración: exclusivamente Editor → Mis proyectos. Se conserva el shell aprobado, el logo oficial y los cambios anteriores de Mi trabajo. La auditoría inicial incluyó `git status`, `git diff --stat`, `git diff` y los últimos 15 commits, con HEAD `0572f2e`. El árbol ya contenía los cambios sin commit de la iteración anterior; no se revirtieron ni se rediseñaron esas pantallas.

La referencia se utilizó para la relación lista/detalle, densidad y jerarquía. Ningún nombre, portada, código, fecha, descripción o contador de la imagen se incorporó al producto.

| Ref. | Punto solicitado | Resultado |
|---|---|---|
| A | Ruta anterior | `frontend/src/editor/EditorMisProyectos.tsx`, montado por `EditorHomePage.tsx` en `/?vista=mis-proyectos`. Se mantiene la misma ruta y componente. |
| B | Componentes encontrados | Vista anterior con cuatro KPI, grid de tarjetas, toggle de tabla, panel de participación/archivos/historial y resúmenes adicionales de carga. El enlace de intervención usaba incorrectamente su workItemId como projectId. |
| C | Componentes reutilizados | Shell `CrmSidebarLayout`, `TopBar`, `EditorNav`, logo `/brand/panhouse-logo.webp`, `EditorialCover`, `EditorDetail`, `EditorSearch`, `EditorSelect`, `EditorSkeleton`, `EditorEmpty`, fechas, iconos, botones y tokens existentes. Se reutiliza la accesibilidad del drawer ya disponible. |
| D | Legacy descartado/reutilizado | No se revive una matriz ni el editor por fechas de `SeccionEdicion`/`CommandCenterEdicion`. Se reutilizan `editorialInterventions`, `projectState`, `specialistsFor`, workspace metadata y modelos canónicos. La proyección específica nueva no crea un segundo dominio ni tablas. El explorador de Jefatura permanece intacto. |
| E | Endpoint usado | Los existentes `GET /api/editores/mis-proyectos` y `GET /api/editores/mis-proyectos/:projectId`, con sesión y rol editor obligatorios. No hay un endpoint paralelo ni acciones de escritura del portafolio. |
| F | Cambios backend | Proyección personal `server/helpers/editorProjects.ts` sobre proyectos, asignaciones, work items, capítulos, auditoría y entregas existentes. Añade conteos de estados, intervención actual, fechas de asignación, lectura histórica acotada, entregas propias y feedback real; busca código y admite orden de trabajo activo primero. Sin migraciones ni enums DB nuevos. |
| G | Scope Editor | Asignación canónica de proyecto, tipo editor y work_item_id null. El puntero `proyectos.editor_id` solo es fallback cuando no existe historial de asignación canónico. Se permite contexto histórico por participación anterior; sin acceso al material, links de archivo ni operación después de la reasignación/cierre. Una proyección antigua no puede conceder acceso a otro editor. |
| H | Una fila = proyecto | `projectsFor` devuelve una fila por projectId; las intervenciones se agrupan por proyecto para sintetizar la participación. Los cinco work items de un proyecto no crean cinco filas. Los proyectos asignados sin work items también aparecen, sin inventar una intervención futura. |
| I | Row DTO | `EditorProjectRow` conserva identidad/servicio, estado editorial, riesgo, portada, Especialista, próxima entrega, actividad y campos compatibles de `EditorialProjectSummary`; añade `participation`, `stateLabel`, `assignedAt`, `endedAt`, `workCounts {known,active,pending,waiting,blocked,completed}` y `currentWork`. Tipos en `shared/editorProjects.ts`. |
| J | Detail DTO | `EditorProjectDetail`: summary, nextStep, interventions, interventionsTotal, drive, materialUnavailable, blockers `{workItemId,reason,createdAt}`, deliveries propias `{id,workItemId,label,driveUrl,submittedAt,observaciones}`, feedback `{id,workItemId,interventionLabel,label,actor,at,kind,pending}` e history. Se carga al seleccionar un proyecto. |
| K | Filtros | Estado editorial derivado, servicio real y participación activa/histórica. Especialista aparece si hay varias opciones útiles o un filtro existente en URL. Limpiar filtros se ofrece únicamente cuando hay filtros o búsqueda. No hay filtro de Editor ni de prioridades inventadas. |
| L | Búsqueda | Título, autoría y código; aplicada en servidor con debounce de 300 ms existente. No usa la página visible como universo de búsqueda. |
| M | Paginación | Servidor, tamaños 10/25/50; rango visible y total, anterior/siguiente, página conservada en URL. Cambiar filtros/orden/tamaño vuelve a la primera. QA de navegador recorrió la segunda página con 12 proyectos actuales persistidos. |
| N | Sorting | Trabajo activo/accionable primero, seguido de espera y ausencia de trabajo activo; históricos separados por filtro. Opciones adicionales de última actividad, título, próxima entrega y estado. Desempate estable por actividad e ID. No es una prioridad nueva de negocio. |
| O | Estado editorial mostrado | Deriva del trabajo asignado: Por iniciar, En edición, Requiere ajustes, Esperando autor/Especialista, En pausa, Bloqueado o Edición finalizada. Participación finalizada y Sin trabajo activo son etiquetas de proyección, sin nuevo estado DB. La dimensión editorial prevalece sobre el estado macro. Una fecha vencida se señala aparte. |
| P | Current intervention | Orden claro entre trabajos actuales: bloqueo real, feedback, trabajo iniciado, pendiente y espera; completos al final. Una intervención accionable tiene preferencia frente a otra esperando al autor. Prueba explícita: Capítulo 6 activo frente a Capítulo 5 en espera. |
| Q | Next deadline | Menor dueDate válido entre intervenciones accionables del proyecto. Se usa el plazo/SLA ya derivado en el servidor; nunca la fecha global/contractual del libro. Esperas no producen vencimiento imputado al Editor. |
| R | Last activity | Eventos reales del catálogo editorial, por proyecto autorizado. Incluye feedback registrado por el Especialista. En históricos se limita a participación/actor/intervalos propios y reasignación relacionada; no incorpora avances posteriores del nuevo Editor ni pagos/RRPP/Comercial. Consulta por lote con DISTINCT ON. |
| S | Progress/count | Conteos reales de intervenciones conocidas y sus estados: completadas, en curso, por iniciar, esperando y bloqueadas. Las históricas cuentan distintos work items con entregas propias, no cada versión como una intervención extra. El tab Entregas conserva cada entrega/versionado registrado. |
| T | Progress = null | Siempre en este dominio actual: capítulos e intervenciones futuras pueden crearse dinámicamente y no hay un denominador final cerrado. Los conteos conocidos de cinco o doce work items son snapshots, no un porcentaje del libro. No se usa el extremo de un rango contractual, una barra ni un total ficticio. No se inventó un caso de progreso fijo ausente en configuración. |
| U | Selected row | Click o Enter/Espacio seleccionan sin navegar; botón semántico con título completo. Fondo cálido neutro y acento dorado discreto. Cerrar deja el estado vacío de selección. Proyecto, filtros, página, orden y sección se conservan en URL. |
| V | Detail panel | Panel derecho blanco con borde sutil, altura ajustada al espacio disponible y acciones visibles al pie; drawer en tablet y pantalla completa en móvil. Foco, Escape y restauración de foco/scroll verificados. Lista y detalle pueden fallar de forma independiente. |
| W | Resumen | Servicio, Especialista canónico, fecha real de asignación, intervención actual, siguiente paso, próxima entrega, bloqueo con motivo/fecha y participación. Vista breve de intervenciones; actividad e historial editorial consultables. Sin descripción inventada: el esquema auditado no ofrece una sinopsis editorial apropiada para esa sección. |
| X | Intervenciones | Todas las conocidas de la participación, sin el recorte anterior de diez. Label/tipo real, estado, deadline o fecha de entrega y enlace al contexto autorizado en Mi trabajo. Históricos muestran únicamente snapshots de entregas propias, sin reinterpretar el trabajo actual del siguiente editor. QA abrió el último de doce work items. |
| Y | Material | Metadata de carpetas editoriales aplicables al servicio, asociadas al workspace persistido. No es un explorador genérico; no muestra RRPP, pagos ni documentación comercial. Vacío honesto y retry si falla la consulta de metadata. |
| Z | Entregas | `editorial_deliveries` del proyecto con submittedBy igual al editor actual de la sesión. Label de intervención, archivo validado previamente por el comando moderno, fecha y observaciones reales. Histórico conserva metadata propia con driveUrl null. No existe Registrar entrega aquí. |
| AA | Feedback | Eventos reales recibidos/aplicados de las intervenciones de ese proyecto, autor/fecha y estado pendiente cuando el workflow real requiere ajustes. Solo el último feedback recibido de un work item todavía en ajustes se marca pendiente. Aplicar en Mi trabajo enlaza al ID exacto; no hay chat ni comentarios simulados. |
| AB | Drive integration | Lista y detalle no llaman Google Drive: leen workspace y folder associations persistidas. Botón Ver en Drive apunta a la carpeta EDITING autorizada, no a la raíz global del proyecto. El entorno de QA no tiene una conexión corporativa real disponible: se comprobaron metadata/IDs, scope y cero llamadas a Google, no la apertura autenticada de una carpeta real en la nube. |
| AC | Folder keys | EDITING; CONTENT_EXTRACTIONS para EF o EDITING_INPUT en otros servicios; EDITING_OUTPUT, EDITING_FEEDBACK, EDITING_FEEDBACK_APPLIED; FULL_MANUSCRIPT y sus keys de feedback; EDITORIAL_KIT y sus keys de feedback. Solo se exponen keys persistidas READY de un workspace listo y con contexto vigente. Las carpetas no se convierten en work items ficticios. |
| AD | Legacy Drive | Se abre el ID persistido aunque displayName/templatePath sean antiguos. Lectura no renombra, mueve, recrea ni migra. Test con templateVersion legacy-v1 y folder ID antiguo; se verifica que la versión permanece intacta y no se consulta Google. |
| AE | Deep link a Mi trabajo | `/?vista=mi-trabajo&project=<projectId>&workItem=<workItemId>`. Se corrigió el enlace que usaba workItemId como projectId de Mis proyectos. Comprobado desde navegador hasta el detalle de la intervención exacta. El enlace inverso existente de Mi trabajo se conserva sin modificar su pantalla. |
| AF | Project view | Omitida. `ProyectoCommandCenterPage` habilita su consulta para especialista, jefe_area y rrpp; Editor no está en esa lista. No se creó una nueva ficha ni un botón que conduzca a una vista no habilitada para el rol. |
| AG | RBAC | Guards de sesión/rol en endpoints; ownership y participación resueltos en backend. Vista de lectura: no asignación/reasignación, edición comercial, cambio de servicio/autor ni ejecución del workflow desde aquí. |
| AH | IDOR | Editor ajeno recibe 404 en detalle y no puede enumerar los proyectos; archivos de work item ajeno se rechazan y su detalle es 404. Test adicional: cambiar solo el puntero legacy editor_id no concede acceso frente a la asignación canónica. Cliente no envía un folderId arbitrario para resolver Material. |
| AI | Performance | Cinco consultas SQL por lista con trabajo actual: proyectos/identidad, intervenciones canónicas, Especialistas, última actividad y agregado de entregas propias. El detalle agrega solo las colecciones del proyecto seleccionado. Filtro/orden/paginación se resuelven en servidor sobre la carga personal; no se afirma paginación SQL ni benchmark masivo. |
| AJ | N+1 audit | No hay una consulta por fila para autor, Especialista, work item o actividad, ni llamadas Drive por proyecto. Agrupaciones/lotes y joins; portadas desde metadata de propuesta aprobada, con fallback editorial si no existe/no carga. No se provisiona un workspace al consultar. |
| AK | Tests nuevos/modificados | Nuevo tests/editorProjects.test.ts: 11 casos de dominio, scope, estados, conteos, búsqueda, paginación, actividad, histórico y Drive. Nuevo frontend/src/editor/editorProjects.test.tsx: 9 casos de lista/detalle, secciones, enlaces, ausencia de progreso, espera, histórico, carga/vacíos/error. Se actualizan los dos casos existentes de Mis proyectos y su fixture/query key. Scripts QA/seed locales aislados nuevos. |
| AL | Resultados tests | [final-tests.json](../evidencias/editor-mis-proyectos/final-tests.json): 102/102 pruebas aprobadas en ocho archivos, con regresión de Editor, Proyectos de edición, Asignaciones y Seguimiento. [visual-qa.json](../evidencias/editor-mis-proyectos/visual-qa.json): 10 comprobaciones de navegador, cero errores JavaScript y cero overflow horizontal. |
| AM | Typecheck | Backend `npm run typecheck` y frontend `npm --prefix frontend run typecheck`: correctos. Se corrigió el tipo opcional de cookie en el helper nuevo de tests. |
| AN | Builds | Backend `npm run build` y frontend `npm --prefix frontend run build`: correctos. Permanece el aviso existente del bundle global mayor de 500 kB; no se amplió esta tarea a dividir la aplicación completa. |
| AO | QA 1440 | Aplicación real con Editor QA, 1440×900. Lista dominante, filas observadas de 78 px, panel de 395 px, selección discreta y CTA visible sin desplazar el panel. [Captura](../evidencias/editor-mis-proyectos/desktop.png), [intervenciones](../evidencias/editor-mis-proyectos/desktop-interventions.png), [última intervención](../evidencias/editor-mis-proyectos/desktop-interventions-end.png). |
| AP | QA 768 | 768×1024, lista completa y drawer de 455 px; filtros compactos reordenados. Apertura, cambio de sección, cierre, foco y scroll verificados. [Lista](../evidencias/editor-mis-proyectos/tablet.png), [detalle](../evidencias/editor-mis-proyectos/tablet-detail.png). |
| AQ | QA 375 | 375×812: elementos de proyecto de 351 px de ancho, sin tabla horizontal; servicio, estado, trabajo actual, próxima entrega y actividad. Detalle completo con navegación entre secciones y CTA visible. [Lista](../evidencias/editor-mis-proyectos/mobile.png), [detalle](../evidencias/editor-mis-proyectos/mobile-detail.png). |
| AR | Correcciones tras QA | Se redujo la altura de los elementos móviles de ~335 a ~273 px; se limitó la densidad de título/autor en escritorio con acceso al texto completo en detalle/tooltip. El CTA quedaba bajo el fold: se ajustó altura real del panel y footer sticky, y se añadieron aserciones de visibilidad en los tres tamaños. Se comprobó el último work item para evitar ocultarlo bajo las acciones. Se pulieron textos singulares y el siguiente paso de trabajos no iniciados/finalizados. |
| AS | Archivos tocados | Esta iteración: EditorMisProyectos.tsx, editorApi.ts, casos/fixture de Mis proyectos en editor.test.tsx, rutas GET correspondientes en editor.routes.ts; nuevos misProyectos.css, shared/editorProjects.ts, server/helpers/editorProjects.ts, ambos editorProjects.test, scripts editor-projects-qa-seed.ts/editor-projects-visual-qa.mjs, evidencias e informe. No se rediseñaron Inicio, Mi trabajo, Mis solicitudes ni las áreas de supervisión. |
| AT | git diff --stat | Árbol combinado sin commit: 9 archivos tracked, 363 inserciones, 166 eliminaciones. Incluye los cambios anteriores de Mi trabajo. El subconjunto de cuatro archivos tracked relacionados con esta pantalla muestra 140 inserciones y 69 eliminaciones, pero editor.test.tsx/editor.routes.ts también contienen cambios previos conservados. Los nuevos archivos aún untracked se enumeran debajo. |
| AU | git status | Árbol sin commit. Se conservan las siete modificaciones tracked y cuatro rutas nuevas de Mi trabajo anteriores; se añaden los archivos/evidencias de esta pantalla. Estado literal debajo. `git diff --check` sin errores de whitespace. |

```text
frontend/src/editor/EditorMiTrabajo.tsx    | 234 +++++++++++++++++++----------
frontend/src/editor/EditorMisProyectos.tsx | 157 +++++++++++++------
frontend/src/editor/EditorUi.tsx           |  12 +-
frontend/src/editor/editor.test.tsx        |  29 +++-
frontend/src/editor/editorApi.ts           |   6 +-
server/helpers/editorWork.ts               |  30 ++--
server/routes/editor.routes.ts             |  17 +--
shared/editorOwn.ts                        |   1 +
tests/editor.test.ts                       |  43 ++++++
9 files changed, 363 insertions(+), 166 deletions(-)
```

```text
 M frontend/src/editor/EditorMiTrabajo.tsx
 M frontend/src/editor/EditorMisProyectos.tsx
 M frontend/src/editor/EditorUi.tsx
 M frontend/src/editor/editor.test.tsx
 M frontend/src/editor/editorApi.ts
 M server/helpers/editorWork.ts
 M server/routes/editor.routes.ts
 M shared/editorOwn.ts
 M tests/editor.test.ts
?? docs/auditoria/31-editor-mi-trabajo.md
?? docs/auditoria/32-editor-mis-proyectos.md
?? docs/evidencias/editor-mi-trabajo/
?? docs/evidencias/editor-mis-proyectos/
?? frontend/src/editor/editorProjects.test.tsx
?? frontend/src/editor/miTrabajo.css
?? frontend/src/editor/misProyectos.css
?? scripts/editor-mi-trabajo-qa.mjs
?? scripts/editor-projects-qa-seed.ts
?? scripts/editor-projects-visual-qa.mjs
?? server/helpers/editorProjects.ts
?? shared/editorProjects.ts
?? tests/editorProjects.test.ts
```

La previsualización de QA está en `http://127.0.0.1:5176/?vista=mis-proyectos`, con API 3009 y base local aislada `panhouse_editor_preview_20261026`. `editor-projects-qa-seed.ts` añade fixtures identificadas como prueba exclusivamente allí, mediante entidades/comandos del dominio. No modifica datos de desarrollo ni copia la referencia visual. Las capturas usan la aplicación real y datos persistidos, sin interceptar las respuestas de lista/detalle salvo la comprobación explícita de error temporal y retry.

## Corrección del entorno de desarrollo — 27 de octubre de 2026

La pantalla de `localhost:5173` fallaba porque la base de desarrollo tenía aplicadas las migraciones hasta 0086. La consulta del portafolio devolvía PostgreSQL `42P01`: no existía `editorial_deliveries`; tampoco existía `editorial_blockers`. La validación anterior se había realizado sobre la base aislada de QA y no detectó este desfase.

Se revisaron las migraciones pendientes 0087–0089, se generó un respaldo completo en formato personalizado de PostgreSQL fuera del repositorio y se ejecutó `npm run db:migrate` sobre la base de desarrollo. La ejecución terminó correctamente, sin borrar datos ni cambiar credenciales.

Verificación posterior: ambas tablas existen, el portafolio del Editor activo devuelve sus 20 proyectos y las 20 consultas de detalle terminan correctamente. En la pestaña existente de Chrome, con la sesión del usuario y el origen `http://localhost:5173/?vista=mis-proyectos`, se comprobó el listado `1–20 de 20 proyectos` y el panel de resumen con sus intervenciones y enlace a Mi trabajo. No se necesitaron cambios adicionales de código ni reiniciar la sesión.
