# Corrector → Inicio — implementación y validación

27 de octubre de 2026. Alcance: únicamente Inicio del Corrector. Se conservaron los cambios previos sin commit del Editor. Antes de implementar se revisaron status, diff, diff --stat y los últimos 15 commits; el diff previo se guardó fuera del repositorio en los artefactos locales.

| Punto | Tema | Resultado |
|---|---|---|
| A | Estado previo | El rol aterrizaba directamente en `MisCorreccionesPage`: bandeja legacy con inicio/entrega, sin Inicio ni resumen propio. Se conserva esa bandeja y se incorpora un Inicio independiente. |
| B | Rol técnico | `corrector`, con sesión activa y middleware requireRole. HomePage selecciona la vista según el rol autenticado, no según un rol enviado por el navegador. |
| C | Interno/freelance | Correcciones almacena correctorId o correctorNombre, freelance y contratoConfirmado. El flujo actual de freelance sin cuenta se gestiona desde Especialista y Talento; esa persona no puede iniciar sesión por su nombre. Una cuenta con rol corrector usa esta misma interfaz y la misma autorización, sin bifurcar pantallas ni mostrar badges laborales. El alta y la vinculación contractual de cuentas freelance no se modificaron en Inicio. |
| D | Cuenta reutilizable | La cuenta identifica a la persona y puede tener cero, una o varias intervenciones en distintos proyectos. No se crean/borran usuarios por cada proyecto. QA usa cuentas estables en una base aislada. Tests cubren entrega de A y asignación posterior de B con la misma cuenta. |
| E | Assignments | project_assignments con tipo corrector y scope work_item_id. Si existe historial de ese scope, la asignación canónica activa decide el acceso. Solo si nunca hubo historial se admite el puntero legacy correcciones.corrector_id. Un assignment finalizado no permite ver trabajo activo. Una entrega propia dentro del período de asignación puede seguir visible tras finalizar su participación. |
| F | Work item | Se reutilizan correcciones y work_items tipo correccion, ligados al mismo proyecto. Una fila por intervención; varios alcances o rondas del mismo proyecto son trabajos distintos. No hay tablas nuevas. |
| G | Activa | Intervención no cancelada ni completada, asignada al usuario y de proyecto no culminado/retirado. Bloqueadas y pausadas permanecen visibles como activas con responsabilidad diferenciada. |
| H | Vence pronto | evaluarPlazoCorreccion central, con UMBRAL_PROXIMO_A_VENCER_HORAS existente de 24 h. No se calcula el SLA en React. Tripa completa conserva 120 h continuas y preliminares/cubierta extendida 12 h; se muestra dueAt persistido con hora. |
| I | Vencida | Deadline pasada y responsabilidad accionable del Corrector. No se imputa como vencimiento personal una intervención bloqueada o en proyecto/pausa vigente. El dashboard no modifica deadlines ni implementa un nuevo motor para desplazar SLA. La pausa se comunica como estado de proyecto, sin prometer un recálculo del plazo. |
| J | Completada | work_items.estado=completado, que en el flujo de Corrección se registra al entregar; no equivale a la calificación posterior del Especialista. Por eso la UI dice Entregadas este mes. Período explícito: mes calendario actual en America/Caracas, con fechas precisas o DATE legacy sin inventar horas. No incluye entregas futuras. |
| K | Endpoint | Nuevo GET `/api/correcciones/inicio`, sin correctorId arbitrario ni parámetros de consulta admitidos. Rol corrector y sesión obligatorios. El usuario se obtiene de la sesión. No requiere migración. |
| L | Summary DTO | today, monthLabel y summary con active, dueSoon, overdue, completedThisMonth. Los conteos consideran toda la carga autorizada antes del límite de elementos mostrados. |
| M | Attention DTO | correctionId, workItemId, projectId, código, título, autoría, portada aprobada o placeholder, alcance real, estado/label, deadline, estado de plazo, blocker, actionable, completedAt y CTA. Incluye hasta ocho activas, nextDeadline derivado y hasta tres entregadas del mes. Sin contratos, pagos, carga del equipo o datos de otros Correctores. |
| N | Header | Inicio; subtítulo operativo; breadcrumb Corrector → Inicio; fecha actual; topbar con nombre de la sesión. No se copia el saludo ni una identidad de la referencia. |
| O | Sidebar | Inicio y Mi trabajo, logo oficial `/brand/panhouse-logo.webp`, navy y footer Historias que conectan. No existe todavía un dominio funcional de solicitudes del Corrector, por lo que no se inventa esa pantalla ni su enlace. Drawer móvil mediante dialog nativo con cierre y Escape. |
| P | Resumen | Cuatro tarjetas de lectura con métricas calculables: activas, vencen pronto, vencidas y entregadas del mes. No se inventan porcentajes, scores, productividad, ratings o prioridades formales. |
| Q | Requiere tu atención | Lista dominante, ordenada por vencidas accionables, próximas, bloqueadas, en corrección, asignadas y pausadas; deadline/título/ID desempatan. Completadas en sección separada. Motivo real de bloqueo visible cuando existe. Acciones según estado: Abrir trabajo, Continuar, Ver trabajo y Ver entrega. |
| R | Próxima entrega | Solo una fecha futura registrada y accionable, calculada del conjunto autorizado completo. No se toma una vencida como próxima ni una pausa como atraso. Si no existe, el bloque lo explica y el resto del dashboard sigue visible. Al ser un dato derivado de la misma consulta, no hay una segunda petición que pueda tumbar el resumen. |
| S | Guía lateral | Tres instrucciones compactas del proceso real: material de Para corregir, control de cambios e informe técnico, y archivos en Corregido con registro de entrega. No es wizard, progreso o checklist. No promete un explorador documental nuevo. |
| T | Elementos descartados | Ilustración grande, nombres/portadas/fechas/cantidades de referencia, capítulos por defecto, Drive global, guía descargable inexistente, reporte de bloqueo sin comando propio y Mis solicitudes sin dominio definido. Se conservan únicamente los tres alcances reales de Corrección. |
| U | Deep link | `/?vista=mi-trabajo&workItem=<uuid>` abre la intervención exacta en la bandeja existente. GET mias admite ese filtro y devuelve 404 si no está autorizada. El puente añade retorno a Inicio/Ver todo mi trabajo, sin rediseñar la bandeja ni duplicar un detail de Inicio. El nuevo alcance de lectura canónico también se aplica a mias para que el enlace respete la misma asignación. |
| V | Notificaciones | Se reutiliza la campana global. El flujo existente ya notifica asignación/reasignación al usuario y entrega al Especialista. Inicio solo lee: no cambia estado, crea avisos ni registra un evento por abrirlo. No se inventaron recordatorios, bloqueos resueltos o entrega aceptada si no existe el evento correspondiente. |
| W | RBAC | Cuenta activa + sesión + rol corrector + asignación de intervención. Cuenta habilitada sin trabajo recibe cero y un vacío válido; cuenta inactiva recibe 401. Sin acciones administrativas, edición de deadlines o asignación a terceros. |
| X | IDOR | Tests comprueban otra intervención y el proyecto ajeno, rechazo 403/404, rol incorrecto y parámetros de suplantación. QA real reasigna una intervención entre dos cuentas y verifica que desaparece del anterior y aparece en el nuevo. No se autoriza por coincidencia de nombre freelance. |
| Y | Performance | Una consulta SQL para el dashboard; joins a proyectos/work items/autor y subconsultas correlacionadas para autoría, ownership y pausas. Conteos y orden del conjunto personal antes de limitar a ocho filas. No se afirma un benchmark masivo ni paginación SQL. |
| Z | N+1 | No hay consulta de proyecto/autor/actividad por cada fila ni llamadas a Google Drive. Test cuenta una llamada al pool y cero a Google. No se cargan archivos ni se provisionan workspaces desde Inicio. Folder keys existentes auditadas: CORRECTION, CORRECTION_INPUT, CORRECTION_OUTPUT; el dashboard no construye URLs de carpetas. |
| AA | Tests nuevos/modificados | Nuevo tests/correctorHome.test.ts (14 casos), nuevo frontend/src/corrector/correctorHome.test.tsx (10 casos). Cobertura de vacío, varios trabajos, SLA exacto, pausas/bloqueo, entregas, mes de Caracas, cuenta reutilizada, asignaciones finalizadas, freelance, fallback legacy, reasignación, RBAC, IDOR, consulta única y ausencia de escrituras/Drive. |
| AB | Tests ejecutados | 80/80 pruebas correctas en seis archivos: Corrector Inicio backend/frontend, Correcciones, SLA de Corrección, assignments y regresión de interfaz Editor. [Resultado](../evidencias/corrector-inicio/final-tests.json). QA de navegador: seis comprobaciones completas, cero errores JavaScript. [Resultado visual/funcional](../evidencias/corrector-inicio/visual-qa.json). |
| AC | Typecheck | Backend `npm run typecheck` y frontend `npm --prefix frontend run typecheck` correctos. |
| AD | Builds | Backend `npm run build` y frontend `npm --prefix frontend run build` correctos. Permanece el aviso anterior del bundle global mayor de 500 kB; no se amplió el alcance a dividir toda la aplicación. |
| AE | QA 1440 | 1440×900, lista dominante, rail de 290 px, cuatro tarjetas y seis correcciones con distintos estados. Filas normales de 71 px; la bloqueada usa 92 px para conservar el motivo completo. [Captura](../evidencias/corrector-inicio/desktop.png). [Vacío](../evidencias/corrector-inicio/empty.png), [una asignación](../evidencias/corrector-inicio/single.png). |
| AF | QA 768 | 768×1024, lista de ancho completo y rail debajo, sin solapamiento ni desborde horizontal. [Captura](../evidencias/corrector-inicio/tablet.png). |
| AG | QA 375 | 375×812, resumen en dos columnas, intervenciones como elementos compactos de 188–223 px, guía debajo y menú drawer con Escape. Cero overflow horizontal. [Inicio](../evidencias/corrector-inicio/mobile.png), [menú](../evidencias/corrector-inicio/mobile-menu.png). |
| AH | Correcciones tras mirar capturas | Se eliminó el código como tercera línea redundante de cada fila —queda disponible como título—, se amplió el texto pequeño de escritorio, se redujeron filas normales de 84 a 71 px, se compactó la guía y se ajustó el acceso rápido para usar el CTA real del estado. Bloqueada usa Ver trabajo porque la bandeja legacy no tiene un detail específico de bloqueos. Se inspeccionaron las capturas finales. |
| AI | Archivos tocados | Nuevos CorrectorHomePage.tsx, correctorHome.css, correctorHome.test.tsx, shared/correctorHome.ts, server/helpers/correctorHome.ts, tests/correctorHome.test.ts, dos scripts de QA e informe/evidencias. Cambios mínimos en HomePage y AppLayout para montar el Inicio y evitar doble topbar; correcciones.routes para endpoint y deep link; correcciones.ts para scope de lectura; correccionesApi y seis líneas de MisCorreccionesPage para el puente de navegación. No se rediseñó Mi trabajo ni otras pantallas. |
| AJ | git diff --stat | Árbol combinado con tareas anteriores: 18 tracked, 595 inserciones y 263 eliminaciones. Subconjunto tracked de esta tarea: seis archivos, 27 inserciones y ocho eliminaciones. Los archivos nuevos se listan debajo. No se creó commit. |
| AK | git status | Cambios anteriores preservados, sin stage ni commit. `git diff --check` correcto. Estado literal debajo. |

## Validación real y límites de alcance

La base de desarrollo se consultó con el helper final: la cuenta Corrector DEMO existente tiene tres activas y cuatro entregadas en el mes. No se crearon cuentas, asignaciones ni datos de ejemplo en desarrollo durante esta tarea; tampoco se necesitó migración.

QA se ejecutó con la aplicación real y PostgreSQL en la base local aislada `panhouse_corrector_preview_20261027`, API 3012 y frontend 5178. Las asignaciones, inicios, entregas y reasignaciones usan comandos existentes. Los deadlines de los fixtures y el bloqueo/pausa se establecen expresamente para los escenarios de prueba. La única respuesta interceptada fue un 503 temporal del dashboard para probar Reintentar. Se verificaron casos de cero, una y varias asignaciones, navegación exacta y cambio real de Corrector.

También se abrió Chrome, se inició sesión por la pantalla de login con la cuenta Corrector QA y se dejó su Inicio abierto en `http://127.0.0.1:5178/`. La sesión de desarrollo en localhost no se cerró ni se alteraron sus credenciales. [Captura del navegador visible](../evidencias/corrector-inicio/browser-preview.png).

El flujo documental de la bandeja legacy sigue usando enlaces introducidos por el usuario; no tiene aún selector seguro de archivos ni un sistema propio de solicitudes/bloqueos de Corrector. Esos gaps quedan documentados para la iteración correspondiente. Inicio no añade uploads ni simula capacidades de Drive, no valida archivos de entrega y no altera los comandos de inicio/entrega/cierre existentes.

```text
 frontend/src/HomePage.tsx                      |   3 +-
 frontend/src/corrector/MisCorreccionesPage.tsx |   6 +-
 frontend/src/editor/EditorHomePage.tsx         |   2 +-
 frontend/src/editor/EditorMiTrabajo.tsx        | 234 ++++++++++++++++---------
 frontend/src/editor/EditorMisProyectos.tsx     | 157 ++++++++++++-----
 frontend/src/editor/EditorMisSolicitudes.tsx   | 220 ++++++++++++++++-------
 frontend/src/editor/EditorUi.tsx               |  12 +-
 frontend/src/editor/editor.test.tsx            |  31 +++-
 frontend/src/editor/editorApi.ts               |   6 +-
 frontend/src/layout/AppLayout.tsx              |   2 +-
 frontend/src/proyectos/correccionesApi.ts      |   4 +-
 server/helpers/correcciones.ts                 |   9 +-
 server/helpers/editorOwnRequests.ts            |  56 ++++--
 server/helpers/editorWork.ts                   |  30 ++--
 server/routes/correcciones.routes.ts           |  11 +-
 server/routes/editor.routes.ts                 |  21 +--
 shared/editorOwn.ts                            |  11 +-
 tests/editor.test.ts                           |  43 +++++
 18 files changed, 595 insertions(+), 263 deletions(-)
```

```text
 M frontend/src/HomePage.tsx
 M frontend/src/corrector/MisCorreccionesPage.tsx
 M frontend/src/editor/EditorHomePage.tsx
 M frontend/src/editor/EditorMiTrabajo.tsx
 M frontend/src/editor/EditorMisProyectos.tsx
 M frontend/src/editor/EditorMisSolicitudes.tsx
 M frontend/src/editor/EditorUi.tsx
 M frontend/src/editor/editor.test.tsx
 M frontend/src/editor/editorApi.ts
 M frontend/src/layout/AppLayout.tsx
 M frontend/src/proyectos/correccionesApi.ts
 M server/helpers/correcciones.ts
 M server/helpers/editorOwnRequests.ts
 M server/helpers/editorWork.ts
 M server/routes/correcciones.routes.ts
 M server/routes/editor.routes.ts
 M shared/editorOwn.ts
 M tests/editor.test.ts
?? docs/auditoria/31-editor-mi-trabajo.md
?? docs/auditoria/32-editor-mis-proyectos.md
?? docs/auditoria/33-editor-mis-solicitudes.md
?? docs/auditoria/34-corrector-inicio.md
?? docs/evidencias/corrector-inicio/
?? docs/evidencias/editor-mi-trabajo/
?? docs/evidencias/editor-mis-proyectos/
?? docs/evidencias/editor-mis-solicitudes/
?? frontend/src/corrector/CorrectorHomePage.tsx
?? frontend/src/corrector/correctorHome.css
?? frontend/src/corrector/correctorHome.test.tsx
?? frontend/src/editor/editorProjects.test.tsx
?? frontend/src/editor/editorRequests.test.tsx
?? frontend/src/editor/miTrabajo.css
?? frontend/src/editor/misProyectos.css
?? frontend/src/editor/misSolicitudes.css
?? scripts/corrector-home-qa-server.ts
?? scripts/corrector-home-visual-qa.mjs
?? scripts/editor-demo-movements.ts
?? scripts/editor-mi-trabajo-qa.mjs
?? scripts/editor-projects-qa-seed.ts
?? scripts/editor-projects-visual-qa.mjs
?? scripts/editor-requests-qa-seed.ts
?? scripts/editor-requests-qa-server.ts
?? scripts/editor-requests-visual-qa.mjs
?? server/helpers/correctorHome.ts
?? server/helpers/editorProjects.ts
?? shared/correctorHome.ts
?? shared/editorProjects.ts
?? tests/correctorHome.test.ts
?? tests/editorProjects.test.ts
?? tests/editorRequests.test.ts
```
