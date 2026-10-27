# Validación del rol Editor — 26 de octubre de 2026

Se contrastó la [Matriz original de Editores en Google Drive](https://docs.google.com/spreadsheets/d/1GGGXyIJFJ0rBYVOAAHdTzQA1wh7snQ5UhhAt07NX0N0/edit?usp=drivesdk) sin modificarla ni copiar datos personales.

La implementación conserva una única fuente de trabajo para Editor, Especialista y Jefatura. El resumen técnico completo está en [30-editor.md](../arquitectura/30-editor.md).

## Evidencia

- [QA visual](../evidencias/editor/visual-qa.json): doce combinaciones de pantalla/tamaño, sin overflow ni errores de JavaScript.
- [QA funcional en navegador](../evidencias/editor/functional-qa.json): avance, solicitud contextual, devolución, respuesta, resolución, destino de notificación, aclaración al Especialista y búsqueda vacía.
- [QA de reasignación](../evidencias/editor/reassignment-qa.json): cambio canónico, resolución por Jefatura, resultado para el Editor anterior y traslado de trabajo al nuevo Editor. [Captura](../evidencias/editor/reassignment-result.png).
- [Pruebas dirigidas](../evidencias/editor/targeted-tests.json): reporte de la ejecución dirigida anterior al cierre de la suite completa.
- [Regresión completa](../evidencias/editor/full-regression.json): resultado final de Vitest.
- [Pruebas de cierre](../evidencias/editor/final-affected-tests.json): rutas y vistas afectadas por el resultado de reasignación, incluida la selección exacta entre varias solicitudes.

| Ref. | Área | Resultado / evidencia |
|---|---|---|
| A | Estado previo | Cuatro vistas existentes; entrega no atómica, pertenencia Drive sin verificar, solicitudes sin integración de destinatario composición visual heredada y una ruta legacy que permitía escribir fechas sin entrega verificada. |
| B | Rol/capabilities | Se conserva editor. Ejecución propia; no asignación ni gestión del equipo. Guards en backend. |
| C | Matriz | Matriz nativa original localizada en Google Drive: encabezados, instructivo, roles y muestra acotada de fases contrastados con el dominio. |
| D | Ownership | Tabla completa de propiedad en arquitectura/30-editor.md. |
| E | Work item | Unidad por capítulo/intervención; el contenedor no suma una fila adicional cuando hay capítulos. |
| F | Asignación | project_assignments + proyección proyectos.editor_id; revalidación transaccional. |
| G | Deliverable | editorial_deliveries con proyecto, work item, driveFileId validado, enlace, actor, fecha y observaciones. |
| H | Drive | GoogleDriveAdapter y OAuth existentes; mismo scope drive.file. |
| I | Folders/versiones | IDs/folderKeys persistidos. La consulta no crea ni migra carpetas; prueba legacy-v1. |
| J | Waiting | Autor/Especialista/pausa no son accionables ni vencidos del Editor. |
| K | Deadline/SLA | edicionSla.ts central; React formatea, no calcula plazos. |
| L | Feedback | Reabre la misma intervención; la entrega aplica el ciclo existente. |
| M | Bloqueos | Lifecycle explícito; reporte avisa a Jefatura y resolución avisa al Editor cuando corresponde. |
| N | Requests | solicitudes_area existente: apoyo, reasignación y aclaración con contexto obligatorio. |
| O | Inicio backend | Resumen y atención del dominio compartido; conteos semanales sin porcentaje. |
| P | Inicio UI | Atención dominante, próximas entregas, feedback, estado semanal y accesos válidos. |
| Q | Mi trabajo backend | Tabs, búsqueda, estado, tipo, servicio, proyecto, fecha y paginación en servidor. |
| R | Mi trabajo UI | Tabla/lista responsive y master-detail; abrir no inicia. |
| S | Entrega | Transacción única con transición, deliverable, auditoría y notificación; idempotencia por ciclo. |
| T | Archivo Drive | Selector contextual paginado, enlace validado y carga opcional de documento en carpeta autorizada. |
| U | Avance | Observación append-only auditada; sin porcentaje arbitrario. |
| V | Reportar bloqueo | Motivo obligatorio, estado y rastro explícitos; no request automática. |
| W | Mis proyectos backend | Resumen por proyecto; alcance activo/histórico; opciones y metadata documentales acotadas. |
| X | Mis proyectos UI | Tarjetas/tabla funcionales, filtros y carga real por proyecto. |
| Y | Detalle proyecto | Resumen, participación, archivos e historial; ejecución vuelve a Mi trabajo. |
| Z | Mis solicitudes backend | Outbox del autor con filtros, conteos, paginación, versión y resolución. |
| AA | Mis solicitudes UI | Bandeja enviada y detalle con recorrido, observaciones y resultado. |
| AB | Crear solicitud | Tipos cerrados y proyecto/intervención obligatorios; duplicado abierto rechazado. |
| AC | Detalle request | Destino, motivo, estado, actor/fecha de resolución e historial. |
| AD | Comentarios | Preguntas/respuestas en informacion_solicitud_area; no chat nuevo. |
| AE | Cross-role | Flujo real de QA en navegador: Editor solicita → Jefe devuelve → Editor responde → Jefe resuelve. |
| AF | Jefatura | Apoyo/reasignación incluidos en inbox compartida; reasignación usa comando existente. |
| AG | Especialista | Aclaraciones recibidas en Solicitudes; solo el destinatario actual puede resolver. |
| AH | Notificaciones | Migración 0089 agrega destino contextual; fallback conserva enlaces anteriores. |
| AI | Audit | Inicio, avance, carga, entrega, bloqueo y lifecycle de solicitudes. Abrir no escribe. |
| AJ | RBAC | Guards y autorización del servicio para cada comando y destinatario. |
| AK | IDOR | IDs ajenos, archivo externo, carpeta no permitida y reasignación en vuelo cubiertos. |
| AL | Performance | Listas sin llamadas Google; detalle y archivos solo al seleccionar/actuar. |
| AM | N+1 | Consultas por lotes y selector de una carpeta; sin consulta Drive/proyecto/autor por fila. |
| AN | Pruebas nuevas | Idempotencia estricta, rollback, MIME derivado, carrera de carga/entrega, histórico, solicitudes y selector legacy. |
| AO | Tests totales | 1702/1702 en la ejecución completa; 57/57 de cierre en 4 archivos afectados. Los conteos se solapan. |
| AP | Regresión completa | 1702/1702 aprobadas en 96 archivos, sin faltantes ni duplicados. Las pruebas de cierre posteriores se documentan por separado. |
| AQ | Build/typecheck | Backend y frontend compilan; ver resultado automático. |
| AR | QA Inicio escritorio | Captura 1440×900 revisada contra la referencia; atención y jerarquía compartidas. |
| AS | QA Mi trabajo escritorio | Captura 1440×900; lista dominante, detalle operativo y acciones contextualizadas. |
| AT | QA Mis proyectos escritorio | Captura 1440×900; tarjetas por proyecto y participación real, sin porcentajes. |
| AU | QA Mis solicitudes escritorio | Captura 1440×900; outbox y timeline, sin analytics decorativos. |
| AV | Correcciones visuales | Sidebar/branding, tipografía serif, densidad, KPI, iconos, tablas, paneles, botones y estados. |
| AW | Tablet | Cuatro capturas 768×1024; KPI 2×2, detalle drawer y sin overflow. |
| AX | Móvil | Cuatro capturas 375×812 y detalle; filas como tarjetas, Escape y navegación verificados. |
| AY | Drive QA | Proveedor controlado + PostgreSQL real. Google vivo pendiente: la base local no tiene conexión registrada. |
| AZ | Legacy QA | IDs y templateVersion legacy-v1 permanecen iguales tras lectura/selección. |
| BA | Process-version QA | Se interpreta metadata persistida; no se inventa processVersion donde el modelo no lo tiene. |
| BB | Docs | Arquitectura 30 actualizada, reporte de validación y evidencias reproducibles. |
| BC | Límites conocidos | Matriz original auditada en Drive. PanHouse local no tiene OAuth registrado; no se afirma una entrega contra Google real. |
| BD | Diff stat | 85 archivos, 30048 inserciones y 674 eliminaciones; incluye evidencias y el snapshot estándar de Drizzle. |
| BE | Git status | Árbol inicial limpio; estado final documentado tras el commit. |
| BF | Commit | Commit local de la implementación; hash en la respuesta final y git log. |

## Comparación visual

Las cuatro referencias se usaron como sistema visual: sidebar azul marino, tipografía editorial, dorado, cards blancas, tabla con detalle, filtros y timeline. Sus portadas, personas, fechas, números y porcentajes no se importaron.

| Vista | Escritorio | Tablet | Móvil |
|---|---|---|---|
| Inicio | [1440](../evidencias/editor/inicio-desktop.png) | [768](../evidencias/editor/inicio-tablet.png) | [375](../evidencias/editor/inicio-mobile.png) |
| Mi trabajo | [1440](../evidencias/editor/mi-trabajo-desktop.png) | [768](../evidencias/editor/mi-trabajo-tablet.png) | [375](../evidencias/editor/mi-trabajo-mobile.png) |
| Mis proyectos | [1440](../evidencias/editor/mis-proyectos-desktop.png) | [768](../evidencias/editor/mis-proyectos-tablet.png) | [375](../evidencias/editor/mis-proyectos-mobile.png) |
| Mis solicitudes | [1440](../evidencias/editor/mis-solicitudes-desktop.png) | [768](../evidencias/editor/mis-solicitudes-tablet.png) | [375](../evidencias/editor/mis-solicitudes-mobile.png) |

Se corrigió un fallo real encontrado en la revisión móvil: varias llamadas consecutivas a setSearchParams restauraban la selección al cerrar con Escape. Los cambios de contexto ahora se aplican juntos. También se corrigió el tamaño y distribución de acciones del detalle.

La comprobación adicional de reasignación descubrió una selección incorrecta cuando había varias solicitudes: un reemplazo textual de SQL aplicaba el ID al subquery en vez de al registro principal. Se eliminó el reemplazo y el filtro se aplica explícitamente a la solicitud. La prueba de integración ahora crea dos solicitudes distintas y verifica el ID exacto y ambos editores. Se repitió el flujo en navegador después de corregirlo.

## Reproducción

1. Ejecutar las migraciones de la base local y las dependencias de PostgreSQL/Redis.
2. `npm test` ejecuta la suite contra la base con sufijo `_test`. La verificación completa de esta entrega usa `node scripts/editor-regression-shards.mjs`: cuatro grupos disjuntos, una base local por grupo, un worker por grupo y timeout de 60 segundos para pruebas/hooks. El consolidado comprueba que estén todos los archivos, sin faltantes ni duplicados.
3. `node --import tsx scripts/editor-qa-server.ts` prepara únicamente `panhouse_editor_preview_20261026` y escucha en 127.0.0.1:3009.
4. Iniciar Vite en 5176 con VITE_API_PROXY_TARGET=http://127.0.0.1:3009.
5. Los scripts `editor-visual-qa.mjs`, `editor-functional-qa.mjs` y `editor-reassignment-qa.mjs` aceptan PANHOUSE_PLAYWRIGHT_MODULE para resolver una instalación local de Playwright, sin añadir dependencia productiva. Reasignación utiliza las cuentas A/B del entorno aislado y consume una intervención asignada; el seed inicial ofrece varias.

Los datos y credenciales de los scripts son exclusivamente fixtures locales de QA. No se modificaron contraseñas, proyectos ni archivos de usuarios reales. La validación documental contra Google requiere una conexión OAuth real y un workspace autorizado; la inspección local encontró ambas tablas vacías.

## Cierre de validación

- Regresión completa: **1702/1702 pruebas aprobadas, 96 archivos**, cero fallos, archivos faltantes o duplicados. Se conservan los cuatro reportes de grupo y el consolidado. Esta ejecución precede a la ampliación final del resultado de reasignación; no se presenta como una ejecución posterior a esa corrección.
- Cierre de las rutas/vistas afectadas: **57/57 aprobadas en 4 archivos**, cero fallos, código de salida 0; resultado en `final-affected-tests.json`. Se repitió después de corregir la selección exacta de solicitud; sus casos se solapan con la regresión completa y no se suman como pruebas únicas.
- Se agregaron 14 casos de integración de Editor/Drive frente al estado inicial, además de ajustar la prueba de la ruta legacy y verificar las vistas existentes.
- Navegador: 12 combinaciones de vista/tamaño, 1 detalle móvil, 7 comprobaciones visuales, 9 operativas y 4 de reasignación; sin errores JavaScript ni overflow observado. El resultado final de reasignación tiene su propia captura.
- Backend: `npm run build` y `npm run typecheck` terminados con código 0. Frontend: `npm run build` terminado con código 0, incluyendo TypeScript y Vite. Se guardan los logs. Vite conserva el aviso de tamaño del bundle principal de la aplicación (1,44 MB / 383 kB gzip); no es un error de compilación.
- Migración local 0089 aplicada. `npm run db:generate` confirmó que no hay cambios de esquema pendientes.
- Límite pendiente: conexión OAuth corporativa y prueba de un archivo real en Google desde PanHouse. La integración de archivos se verificó con PostgreSQL real y un proveedor Google controlado, sin ampliar permisos ni sustituir la conexión existente.
- Diff: 85 archivos, 30048 inserciones y 674 eliminaciones (incluye snapshot de Drizzle y reportes JSON). Árbol inicial limpio; hash y comprobación final del estado en la respuesta de entrega. Commit local, sin push.
