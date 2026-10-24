# Solicitudes de Jefe de Edición · reporte de implementación

Fecha de revisión: 23 de octubre de 2026 (America/Caracas).

Se completó la implementación de dominio y la interfaz sobre la versión previa `0a7a145`. **La aceptación visual queda pendiente**: Computer Use detuvo el acceso a Chrome porque no pudo determinar la URL con suficiente confianza. No se generaron ni se atribuyen capturas, revisión visual o pruebas de interacción de navegador a esta revisión.

## Reporte solicitado A–BB

| Ref. | Resultado |
| --- | --- |
| A · Estado previo | Ya había una primera implementación: lista, dos estados inferidos, detalle parcial y drawer central. Sin cambios tracked previos; solo `scripts/reset-jefe-edicion-password.ts` sin seguimiento, preservado y excluido del commit. Se revisaron status, diff, stat y quince commits. |
| B · Schema | Se reutiliza `solicitudes_area`, extendiendo el CHECK para `editor`; no se crea tabla. `0087_editor_request_lifecycle.sql` migra hechos nativos conservando IDs/actores/fechas. Request y work item tienen lifecycle independiente. |
| C · Tipos reales | `ASSIGN_EDITOR`, persistido como `tipo='editor'`, originado por `solicitarEditor`. |
| D · Tipos descartados | No se inventan requests de Reasignación, Apoyo por carga o Escalación: no tienen origen formal existente. La reasignación real permanece en el flujo central. |
| E · Lifecycle | Pendiente → Resuelta; Pendiente → Devuelta → Pendiente. Devuelta usa `requiere_informacion`; Cancelada refleja cancelación nativa. Abrir no cambia estado. |
| F · Requester/target | Usuario solicitante real, FK; destino Jefe de Edición por tipo/rol. Scope editorial global del rol existente. |
| G · Business key | `(proyecto_id,tipo='editor',business_key='default')`, vinculada al trabajo de inicio existente. |
| H · Duplicados | UNIQUE compartido, bloqueo de proyecto y guard de pedido inicial. Reenvío conserva solicitud y fecha, sin segundo pedido inicial. |
| I · List query | `/api/editores/solicitudes`: CTE y una consulta SQL parametrizada; no carga intervenciones completas para paginar en memoria. |
| J · Detail query | `/api/editores/solicitudes/:id`: búsqueda directa de una request, luego contexto/historial/archivos y resumen de recomendación para la seleccionada. Lectura pura. |
| K · Counts | `pendingTotal` global, solo accionables; coincide con Inicio/sidebar. Tabs cuentan todo el conjunto filtrado. Pausas/gates conservan la request en la bandeja para devolverla; `assignmentReady` impide asignar hasta habilitar el contexto. |
| L · Filtros | Servicio, solicitante, rango de fechas en Caracas y estado por tab. No se agrega filtro de tipo cuando solo hay un tipo. Rango invertido: 400. |
| M · Search | Proyecto, autor, código, solicitante, intervención y notas; SQL, sin distinguir tildes, caracteres LIKE escapados y debounce de 300 ms. |
| N · Pagination | LIMIT/OFFSET en SQL; 10/25/50; página ajustada al máximo; selección del detalle no reinicia página. |
| O · Sort | Más antiguas por defecto; más recientes en Resueltas; proyecto; desempate estable por ID. |
| P · Header | Área de Edición, Solicitudes, propósito operativo. Se conserva shell/sidebar/cuenta/campana real, sin buscador global simulado. |
| Q · KPI | Un KPI principal de Pendientes, con valor global del backend; sin KPI principal de histórico ni números/tipos ficticios. |
| R · Tabs | Pendientes / Resueltas / Devueltas cuando existen / Todas. Estado en URL. |
| S · Table | Una fila = request; proyecto/autor, tipo, descripción, solicitante con iniciales/rol, fecha/hora, estado y Revisar/Ver detalle. Sin asignación directa ni prioridad falsa. |
| T · Selected row | Resaltado gold, selección por click/Enter/Espacio, panel derecho y selectedRequest en URL. |
| U · Resumen | Tipo, estado, solicitante, fecha/hora, proyecto, autor, servicio, intervención, notas reales y fecha/volumen solo si existen. No se fabrican notas del solicitante ni volumen contractual. |
| V · Contexto | Estado editorial, Editor, Especialista, deadline, waitingOn y blocker reales. Contenedor histórico fuera del alcance operativo: explicación y enlace al proyecto. |
| W · Archivos | Solo manuscrito HTTPS relacionado con el pedido inicial; sin explorar Drive ni otras áreas. Enlaces ejecutables excluidos. |
| X · Historial | Audit logs correlacionados con request, trabajo y assignment ID real. Incluye creación, devolución, reenvío y resolución, con motivo/actor/fecha. |
| Y · Recommendation | Resumen de `getEditorLoadSummary` + `recommendEditorsForIntervention`; conserva empates. No devuelve toda la lista ni calcula otro score en Solicitudes. |
| Z · Asignación | CTA navega a Asignaciones y carga con la request exacta y abre el mismo `EditorialDecisionDrawer`. Sin selector duplicado; vuelve al resultado tras resolver. |
| AA · Reasignación | Conserva servicio central, motivo y project_assignments histórico. Reasignar después no modifica el resultado inicial de la request. No hay request separada sin respaldo de negocio. |
| AB · Escalaciones | No se crea tipo/handler ficticio. Un bloqueo existente se supervisa en Seguimiento y no fuerza reasignación ni request nueva. |
| AC · Return | POST protegido, motivo obligatorio, versión esperada, auditoría y aviso transaccionales. Solicitante ve estado/motivo y puede reenviar desde su bandeja. |
| AD · Result | Request resuelta, Editor/actor/fecha y referencias reales a assignment/work item; lectura sin acciones de asignar/devolver; enlace al trabajo y al proyecto. El historial sobrevive al cierre del proyecto. |
| AE · Sidebar | Solo pendientes accionables, excluye devueltas e histórico; comparte la proyección operativa con Inicio. |
| AF · Activity | Audit logs existentes, máximo cuatro eventos; consulta y reintento independientes. No se crean requests por entregas o feedback. |
| AG · Notifications | Pedido/reenvío → Jefe; devolución/resolución → solicitante; asignación → Editor. Las reasignaciones posteriores avisan al Especialista vigente. Retry no duplica. Campana no ofrece asignar una request devuelta. |
| AH · Audit | Eventos tipados para devolución/reenvío, contexto de requestId en asignación y correlación correcta de entidades. No se reescriben eventos anteriores. |
| AI · Idempotencia | Pedidos concurrentes y doble asignación al mismo Editor no duplican request, assignment, work item, evento o notificación. |
| AJ · Concurrencia | Orden común proyecto → request → trabajo; expectedEditorId, expectedAssignmentId y expectedRequestVersion. Devolver/asignar concurrentes: un resultado y un 409. |
| AK · RBAC | Sesión + `jefe_edicion` en list/detail/return/decisión; Especialista asignado para pedir/reenviar. No se opera RRPP, Creativa, Comercial ni trabajo del Editor. |
| AL · IDOR | IDs de trabajo/requests de otros dominios: 404; rol incorrecto: 403; sesión ausente: 401. Propiedad del Especialista revalidada por servidor. |
| AM · Performance | Una consulta SQL para página/conteos/opciones. Detalle acotado y sin N+1: hasta seis lecturas, sin llamadas a Drive. |
| AN · Tests nuevos | 22: quince casos de lifecycle/integración, seis casos adicionales de frontend y una regresión de cierre creativo cuando UTC ya cambió de día. Cubren migración, duplicados, lectura, recomendación, resultado, devolución, reenvío, versiones, concurrencia, fechas, KPI, archivos, rendimiento y flujo HTTP entre módulos. |
| AO · Tests totales | Consolidado final por archivo: **92 archivos, 1.643 tests, 1.643 passed, 0 failed, 0 pendientes**. No se cuentan dos veces los reintentos. |
| AP · Full regression | Suite completa en tres shards aislados, PostgreSQL 16 temporal, tmpfs y fsync activado: 31/31/30 archivos, sin solapamientos ni archivos omitidos. Primera pasada: 1.642 tests, 1.639 passed y 3 failed. Revalidación limpia final de diez módulos sobre el código final: **187/187**; reemplaza íntegramente los resultados anteriores de esos archivos y añade el caso de fecha. Los JSON originales conservan sus fallos; el consolidado declara la procedencia de cada archivo. Ambos contenedores temporales fueron eliminados al terminar. |
| AQ · Builds | Typecheck backend/frontend y builds correctos, incluidos los cambios finales. `tsc` de backend y `tsc -b` de frontend terminaron sin errores. Vite terminó con código 0 y advertencia de chunk principal mayor de 500 kB. |
| AR · QA cross-module | Verificado por HTTP de Fastify con login/sesión: Especialista pide → inbox → decisión central → Editor recibe trabajo → Especialista ve resultado → Inicio/badge bajan. Lifecycle final: **15/15**. Incluye cambio de Especialista, reasignación posterior y cancelación del trabajo sin reescribir la request resuelta. No equivale a una prueba de interacción del navegador. |
| AS · Desktop inicial | No verificado: bloqueo automático de Computer Use al no poder verificar URL de Chrome. |
| AT · Ajustes de interfaz | Tabla dominante, Resueltas deja de ser KPI, cuatro pestañas, rail de 344 px, recomendación compacta, CTA central, estados vacíos/errores separados y cards móviles. Ajustes basados en imagen y código; no se atribuyen a capturas observadas. |
| AU · Desktop final | Pendiente inspección visual a 1440×900. |
| AV · Tablet | CSS de drawer preparado; pendiente inspección a 768×1024. |
| AW · Mobile | CSS de cards/fullscreen preparado; pendiente inspección a 375×812 y validación visual de foco/scroll. |
| AX · Docs | `docs/arquitectura/29-jefe-edicion.md` actualizado, incluyendo request map, lifecycle, integración y límites. Este reporte y evidencia JSON completan la trazabilidad. |
| AY · Known gaps | QA visual de esta ronda bloqueada. No están disponibles los originales de la Matriz de Editores ni del PPTX: se revisaron manual local, arquitectura y auditorías/procedencia existentes. Legacy sin actor superviviente conserva la proyección existente; no se inventa solicitante ni se ofrece devolución sin destinatario. No hay tipo formal de reasignación/apoyo/escalación. |
| AZ · Diff stat | `docs/evidencias/jefe-edicion/solicitudes-diff-stat.txt`, capturado antes de commit. |
| BA · Git status | `docs/evidencias/jefe-edicion/solicitudes-git-status.txt`, capturado antes de commit. El script de reset preexistente queda fuera del commit. |
| BB · Commit | Hash informado en la respuesta final; este reporte forma parte del mismo commit. |

## Validación y evidencia

- Verificación inicial: 20 pruebas de Solicitudes pasaron tras corregir una dependencia de fecha fija en el test previo.
- Primera corrida ampliada: 72/73 pasaron; un test nuevo esperaba 200 donde el endpoint existente devuelve 201 al crear la solicitud. Se corrigió la expectativa; no se alteró el endpoint para acomodar el test.
- La migración local terminó correctamente. Frontend `localhost:5173` responde 200 y API protegida `localhost:3000/api/editores/solicitudes` responde 401 sin sesión.
- La corrida larga comenzó antes de los últimos ajustes: dos casos nuevos cargaron dependencias anteriores. Sin alterar las expectativas, el proceso limpio pasó los **15/15** casos (`solicitudes-lifecycle-final.json`).
- El tercer fallo reveló un problema previo de calendario: `direccionCreativa.ts` generaba fechas de cierre en UTC mientras Indicadores usa Caracas. Se reutilizó `diaCaracas` para cierres y aprobación RRPP; una prueba a las 23:30 de Caracas verifica que el cierre y el indicador permanezcan en ese día.
- Revalidación final independiente: **10 archivos, 187 tests, 187 passed, 0 failed** (`solicitudes-revalidacion-final.json`). Incluye todos los módulos de Edición afectados y los consumidores creativos de la corrección de fecha.
- Consolidado: `solicitudes-regresion-completa.json`. Comprueba inventario de los 92 archivos, ausencia de duplicados entre shards, conservación de todos los casos iniciales al sustituir un archivo por su revalidación, y resultado final **1.643/1.643**. Los reportes originales de los tres shards permanecen intactos.
- `solicitudes-runtime.json` y `solicitudes-revalidacion-runtime.json` registran PostgreSQL 16, tmpfs, fsync activado y limpieza final de los contenedores. No contienen credenciales.

## Bloqueo de revisión visual

Computer Use devolvió: “could not determine the current browser URL on Windows with enough confidence to enforce policy”. Se detuvo la interacción con Chrome conforme a la regla de la habilidad Computer Use: “stop issuing app input”. No se intentó eludir el bloqueo con otra tecnología de navegador.

La implementación y los resultados automatizados se entregan para revisión. No se declara cumplida la definición de terminado visual del pedido hasta completar las tres inspecciones y la comparación con la referencia.
