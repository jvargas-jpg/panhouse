# Soporte Editorial Mi trabajo revisión y cierre

28 de octubre de 2026, America/Caracas. Alcance: exclusivamente Mi trabajo de Soporte Editorial, más las guardas imprescindibles de sus acciones de Calidad. Base: commit `d216b3d`; árbol limpio al comenzar. Se revisaron `git status`, `git diff --stat`, `git diff` y los últimos 15 commits antes de editar.

La implementación anterior ya conectaba la pantalla con Calidad. Se corrigieron la aprobación silenciosa de criterios sin revisar, la pérdida del borrador, la ausencia de acciones en Detalle, la paginación en memoria, la búsqueda sin versión, el cierre prematuro de la espera de Diseño y el acceso operativo durante pausas/bloqueos. Se conserva el dominio existente y su bandeja compartida por rol.

## Auditoría solicitada

| Punto | Resultado |
| --- | --- |
| A. Estado anterior | `d216b3d` ya incluía tabla por ronda, detalle, materiales, checklist y resultado. Faltaban acciones desde Detalle, persistencia del borrador y QA visual documentado. |
| B. Componentes y rutas | `SoporteEditorialMiTrabajo`, `ValidationDetail`, `ResolveForm`, `EditorDetail`, `CrmSidebarLayout`; `/?vista=mi-trabajo`. API `GET /api/calidad/mi-trabajo`, `GET /api/calidad/mi-trabajo/:id`, `PATCH /api/calidad/:id/inicio`, `PATCH /api/calidad/:id/resultado`. |
| C. Rol | `soporte_editorial`. Bandeja compartida confirmada en `docs/arquitectura/14-fase5-calidad.md`, decisión del 8/10/2026. No se inventó asignación individual. |
| D. Modelo de Calidad | Helpers canónicos `iniciarCalidad`, `resolverCalidad`, `coordinarCalidad`, unidos a Diseño, versiones, Ficha y work items. F1, F2.x, F3 y F4.x son fases reales. |
| E. ficha_calidad_fases | Se reutiliza: unicidad ficha/fase/ronda, work item único, versión relacionada, resultado, actor, timestamps, checklist, observaciones y contadores. Sin nueva tabla ni migración. |
| F. Ronda | Una fila por `ficha_calidad_fases.id`; identidad `F{fase}.{ronda}`. El contador ronda pertenece a una fase. |
| G. Versión | `diseno_versiones.id` y `pdf_version` de la ronda; material concreto. |
| H. Ronda y versión | Independientes: test de F2 ronda 11 con V12; F3 ronda 1 reutiliza V1 y referencia correctamente F1.1. El CTA de F3 dice Iniciar revisión final, sin afirmar nueva versión. |
| I. Work item | `work_items` tipo `calidad`, business key del handoff o revisión final. No se creó dominio paralelo. |
| J. Assignment | Especialista mediante `specialistsFor` y asignación canónica; diseñador mediante el puntero vigente del proyecto, documentado en `project_assignments`. Revisor real conservado en `nombre_quien_recibe` y `revisado_por_id`; el primero se muestra en el resultado. |
| K. Waiting | Derivado: ronda vigente con resultado no aprobado = Esperando Diseño. No es nuevo enum. Una subida sin handoff aún no termina la espera. |
| L. Deadline y SLA | `due_at` explícito; estado calculado en servidor con helper existente. No se impone un día universal. No se muestra vencimiento accionable en espera, pausa, bloqueo o completada. Ver pendiente de calendario abajo. |
| M. Tabs | Activas, Pendientes de nueva revisión, Completadas y Todas. Pausas/bloqueos abiertos permanecen visibles con contexto y ejecución deshabilitada. |
| N. Counts | Agregados SQL sobre todos los resultados filtrados, antes de paginar. No dependen de la página visible. |
| O. Search | Debounce existente de 300 ms. Filtrado SQL por título, autor, código, tipo, `Ffase.ronda`, texto ronda N y versión. Parámetros enlazados, sin interpolar búsqueda. |
| P. Filters | Estado, tipo y proyecto; opciones reales. Sin filtro redundante de validador. |
| Q. Pagination | `LIMIT/OFFSET` en PostgreSQL; 10/25/50 por página, página fuera de rango ajustada a la última. UI comprobada con 13 rondas, páginas de 10 y 3. |
| R. Sorting | Prioridad operativa: vencidas accionables, próximas, nuevas, en revisión, espera y completadas; deadline e ID estabilizan orden. |
| S. Row DTO | Identidad de ronda/work item/proyecto, autor, código, portada, fase/ronda, versión, tipo, estado, deadline, actividad, CTA, `actionable`, `paused` y `blockedReason`. No incluye checklist/materiales/observaciones. |
| T. Detail DTO | Amplía la ronda seleccionada con responsables, fechas, materiales, criterios, resultado, observaciones, contadores, revisor y relación con ronda anterior. Carga diferida. |
| U. Selected row | Highlight discreto PanHouse; click o Enter/Espacio seleccionan sin iniciar ni navegar a otra pantalla. Selección/deep link mediante `workItem` (ID de ronda). |
| V. Detail | Contexto de la ronda, próximo paso, responsables de lectura, alertas, acciones al pie. Altura corregida para mantener visibles las acciones y desplazar el contenido interno. |
| W. Materials | Tab con archivos asociados exclusivamente a esa ronda; enlaces externos, sin descarga automática ni explorador Drive. |
| X. Diagramado | `ficha_calidad_fases.pdf_url`, enlazado a versión canónica. |
| Y. Fuente | `disenos.fuente_url`, material fuente registrado al solicitar el trabajo. No búsqueda por nombre. |
| Z. FolderKeys y asociaciones | Este dominio guarda enlaces explícitos, no un catálogo de archivos por folderKey. Se reutilizan estas asociaciones y no se lista la raíz del workspace. No se atribuyen tamaño, nombre o metadatos que el modelo no contiene. |
| AA. Observations | Formulario de la ronda: observaciones generales, observaciones por criterio, PDF comentado, páginas y contadores reales. Resultado cerrado de solo lectura. |
| AB. Modelo de observations | Campos existentes de la Ficha y checklist JSON. No chat ni tabla nueva. Borrador local en `sessionStorage`, por usuario/ronda/versión y pestaña; se elimina tras registro exitoso. No es guardado compartido en servidor. |
| AC. Campos no creados | `PENDIENTE_VALIDACION_DOCUMENTAL` para cualquier nueva taxonomía, severidad, score, KPI o matriz adicional. Los 26 criterios F1 y 24 de F3 sí están respaldados por la Ficha y documentados en 14-fase5-calidad. No se añadió página obligatoria por observación ni nuevas categorías. |
| AD. History | Eventos reales de audit filtrados al work item de esa ronda, más creación desde `solicitado_en`. Referencia anterior calculada por versión/fase/ronda; F3 sobre la misma versión conserva origen. |
| AE. Iniciar | CTA explícito desde Detalle/Materiales/Observaciones. Acción canónica guarda inicio, actor, estado de work item y audit. Abrir la fila no inicia. |
| AF. Completar | Aprobar versión o Devolver comentarios a Diseño, categorías ya existentes. Guardas de frontend más validación canónica de servidor; Sin revisar es distinto de No aplica explícito. |
| AG. Con observaciones | Requiere PDF comentado y cantidad positiva, conserva revisión/actor/fecha/criterios y abre ajustes de Diseño. No aprueba con criterios fallidos ni comentarios pendientes. |
| AH. Waiting Design | Mensaje explícito, sin ejecución ni formulario editable; resultado consultable. Comprobado por UI tras devolución. |
| AI. Nueva ronda | Nace en handoff canónico de nueva versión. No al cerrar ni al subir un PDF antes del handoff. F3 es una solicitud final sobre versión aprobada, no una nueva versión automática. |
| AJ. Preservación | Resultados y PDFs previos no se sobrescriben. Se preserva consulta de revisiones de proyectos culminados. Proyectos retirados y work items cancelados no aparecen. |
| AK. Notifications | Se reutilizan avisos canónicos: Calidad → Diseño/Especialista; handoff de Diseño → Soporte Editorial. No envíos externos añadidos. |
| AL. Audit | Eventos de inicio/resultado y coordinación existentes; pruebas de idempotencia/concurrencia del dominio pasan. No se audita abrir pantalla. |
| AM. Blockers y requests | Bloqueo real de work item se muestra y bloquea inicio/resultado también por API. Se conserva escalación de colección a Jefatura. Sin solicitudes genéricas ni otra pantalla inventada. |
| AN. RBAC | Mi trabajo solo para soporte_editorial; anónimo 401 y otros roles 403. Mutaciones mantienen control de rol. |
| AO. IDOR | UUID inexistente 404; relaciones ronda-versión-proyecto preservadas; versiones históricas y roles ajenos no mutan. Dentro del rol validador las rondas son compartidas por decisión de negocio, no tareas personales. |
| AP. Drive security | Solo se devuelven enlaces asociados por el dominio a la ronda; no se añade proxy de descarga ni navegación raíz. Google sigue autorizando acceso al enlace. La prueba de acceso corporativo a archivos reales queda pendiente, ver abajo. |
| AQ. Performance | Paginación y filtros SQL; proyección de lista sin textos largos/checklist; carga diferida del detalle. Consultas de opciones/counts en paralelo. |
| AR. N+1 | Cuatro consultas por lista no vacía: agregados, opciones, página y última actividad en lote. Test espía comprueba cuatro con 12 rondas; cero llamadas Drive en listado/detalle. |
| AS. Tests nuevos/modificados | `tests/soporteEditorialWork.test.ts`: 5 casos adicionales. `soporteEditorialMiTrabajo.test.tsx`: 3 adicionales. Cobertura de páginas/counts, búsqueda V12/ronda11, subida previa a handoff, pausa/bloqueo, culminación, F3 sobre V1, acciones y No aplica. |
| AT. Resultados tests | Base inicial: 41/41. Regresión ampliada: 309/309 en 12 archivos. Verificación final después de ajustes: 42/42 en Calidad, Mi trabajo backend y frontend. Son corridas con solapamiento; no se suman como pruebas distintas. |
| AU. Typecheck | Backend y frontend correctos, exit 0. Se corrigió además la inferencia del parseo Zod con defaults en la ruta del listado. |
| AV. Builds | Backend y frontend correctos. Vite conserva advertencia de bundle >500 kB; sin error de compilación. |
| AW. QA 1440 | Chromium real 1440×900. Master-detail, materiales, selección, footer visible, totales de todas las páginas; documento de 1440 px sin overflow horizontal. |
| AX. QA 768 | Chromium real 768×1024. Tabla y drawer de 440 px, `aria-modal=true`, foco circular y cierre Escape verificados; documento de 768 px. |
| AY. QA 375 | Chromium real 375×812. Cards compactas y drawer completo; documento de 375 px. Registro con observaciones, espera, aprobación de F2/V2, resultado/historial y bloqueo comprobados. |
| AZ. Correcciones tras QA | Altura/scroll interno/footer del detalle, checklist de una columna, cards móviles compactas, fechas abreviadas con tooltip, eliminación de CTA redundante dentro de su propia pestaña. |
| BA. Archivos tocados | Ocho archivos existentes de UI/contratos/helpers/ruta/tests; script QA aislado, este informe y evidencias. Inventario exacto en `git-status.txt`. |
| BB. git diff --stat | Snapshot final en `../evidencias/soporte-editorial-mi-trabajo/git-diff-stat.txt`. `git diff --stat` por sí solo no incluye archivos nuevos sin seguimiento. |
| BC. git status | Snapshot final en `../evidencias/soporte-editorial-mi-trabajo/git-status.txt`; cambios sin commit. No se alteraron pantallas de Inicio, Corrector, Diseño ni otros roles. |

## Verificación reproducible

El servidor de QA utiliza `panhouse_calidad_preview_20261028`, restringido a PostgreSQL local. Se inicia con `npx tsx scripts/soporte-editorial-work-qa-server.ts` (API 3013). Vite de QA se inicia desde frontend con `VITE_API_PROXY_TARGET=http://localhost:3013` y puerto 5175. La cuenta local de prueba se describe en el propio script. No se cambiaron contraseñas ni proyectos de la base de desarrollo.

Capturas reales y resultados del navegador: `docs/evidencias/soporte-editorial-mi-trabajo/`. Los archivos de ejemplo de QA usan `example.test`; se verificaron asociaciones y enlaces mostrados, sin fingir descarga o inspección de documentos reales de Google. El entorno normal en 5173 seguía mostrando una bandeja vacía porque no tenía rondas operativas registradas.

Comandos ejecutados:

```text
npm test -- tests/soporteEditorialWork.test.ts tests/calidad.test.ts tests/diseno.test.ts tests/workItems.test.ts tests/assignments.test.ts tests/rbac.test.ts tests/projectWorkspace.routes.test.ts tests/projectWorkspace.templates.test.ts tests/trazabilidad.routes.test.ts tests/decisiones.test.ts frontend/src/soporteEditorial
npm test -- tests/soporteEditorialWork.test.ts tests/calidad.test.ts frontend/src/soporteEditorial/soporteEditorialMiTrabajo.test.tsx
npm run typecheck
npm run build
cd frontend
npm run typecheck
npm run build
```

## Pendientes y límites del dominio

- `PENDIENTE_CONFIRMACION_CALENDARIO_SLA_CALIDAD`: el Manual indica un día para F1 sin definir hábiles/continuos. Se conserva timestamp explícito y no se inventan plazos de F2/F3/F4.
- `PENDIENTE_QA_DRIVE_REAL`: falta comprobar apertura con las cuentas corporativas y PDFs reales de una ronda registrada. Esta revisión no cambia permisos de Drive ni los puede garantizar a partir de una URL. Las pruebas de autorización de workspace pasan, pero no sustituyen el acceso efectivo a cada archivo en Google.
- El borrador se conserva en la pestaña del navegador; otra sesión o equipo no lo recibe hasta registrar el resultado en servidor.
- Fuera de alcance: Inicio conserva su navegación legacy a Calidad y su propio agregado de pausas/bloqueos. Se documenta para otra iteración; esta pantalla no se rediseñó aquí.
