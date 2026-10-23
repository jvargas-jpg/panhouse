# Jefe de Edición · Inicio operativo

Fecha: 23 de octubre de 2026. Rol existente: `jefe_edicion`; área: Edición.

## Auditoría previa

El árbol estaba limpio. Se revisaron `git status`, `git diff --stat`, `git diff` y los últimos quince commits antes de modificar código. El rol ya existía en el enum PostgreSQL, las sesiones, Home y los guards. En desarrollo se encontró **Jefe Edición Demo**, `jefeedicion.demo@panhouse.test`, activo; también **Editor Demo**, rol `editor`, activo. No se creó otro rol ni se cambiaron cuentas o credenciales de desarrollo.

El Inicio anterior consultaba `/proyectos/sin-editor` y `/editores/carga`: mezclaba proyectos sin solicitud con trabajo solicitado; la carga legacy ponderaba proyectos por servicio. Esta ponderación sigue disponible para consumidores anteriores, pero no representa capacidad ni se usa en el nuevo Inicio.

Fuentes leídas, sin importar sus cifras o identidades al producto:

- `fuentes-negocio/Editores Matriz Proyectos - Panhouse (1).xlsx`: hojas **EBDD - IA**, **Pausados**, **Instructivo EBDD - IA**, **INDICADORES**; se inspeccionaron encabezados, instrucciones de llenado y muestras de fases.
- `fuentes-negocio/Proceso de adiestramiento - Especialista editorial (3).docx`: estructura, extracción, capítulos/partes, tres días hábiles, feedback, tripa, kit y entregas mediante enlaces.
- Extracción local de **INDICADORES AGOSTO 2026.pptx**, SHA-256 `4ed6de57e2b578fd1b9af449dcfee39fb6afa2f9f0965c1835b63692f4a020be`; láminas 19–26: Editores Innovación, reporte mensual, estatus general y récord por Editor. La extracción y su procedencia coinciden con `docs/auditoria/indicadores-fuente-2026-08.json`. El PPTX original no está en `fuentes-negocio`; se auditó su texto extraído disponible localmente.
- Arquitectura, matriz de capacidades, auditoría de usuarios, asignaciones, solicitudes nativas, capítulos, work items, helpers SLA, Editor y Command Center.

## Mapeo de la matriz

| Campos auditados | Fuente canónica | Destino |
| --- | --- | --- |
| Autor, ficha, colección, servicio | Proyectos, autores, catálogo y ficha | Proyectos de edición |
| Jefe, Editor, coordinador, fecha de asignación | Usuarios y `project_assignments` | Asignaciones y equipo del proyecto |
| Inicio, fase C1–C6/Parte/Tripa, páginas, entrega | `capitulos` y `work_items` repetibles | Mi trabajo del Editor y Seguimiento |
| Inicio/aplicación/entrega de feedback | Fechas del capítulo, intervención y auditoría | Cola del Editor y coordinación del Especialista |
| Estatus, descripción, causa de retraso | Estado de intervención, gate, auditoría y espera del autor | Seguimiento; atención sólo si hay decisión |
| GAP, fin de edición, días y total real de ejecución | Plazos y hechos canónicos; no fórmulas copiadas | Indicadores históricos futuros |

La matriz es una vista operativa. No se creó una tabla espejo, ni se importaron sus filas o nombres. EF y Crudo se leen del catálogo y subtipo de ficha. Sello no recibe Editor automáticamente: el comando exige una intervención de Edición previamente registrada.

## Ownership y transacciones

1. El Especialista asignado solicita Editor por el comando existente `solicitarEditor`.
2. La solicitud nativa es el `work_item` de Edición más su evento `EDITOR_SOLICITADO`. Se conserva la proyección de solicitudes ya utilizada por el Especialista; no hay un segundo lifecycle de requests.
3. Jefe de Edición decide mediante un único drawer compartido por Inicio, Asignaciones y Solicitudes.
4. `asignarEditor` bloquea el proyecto, valida Editor real/activo, usa `asignarConHistorial`, mantiene el puntero, registra auditoría y notificaciones en la misma transacción.
5. El historial de asignación posterior al pedido resuelve la solicitud nativa. No queda una request pendiente junto al trabajo asignado.
6. Un retry con el mismo Editor no duplica historial ni avisos. La unicity por scope y el bloqueo del proyecto evitan dos asignaciones activas. El nuevo comando detecta contexto obsoleto cuando dos decisiones distintas compiten.
7. Reasignar conserva responsable anterior, inicio, fin y motivo; mueve la responsabilidad del proyecto y sus intervenciones, conforme al modelo vigente de Editor por proyecto. No se inventó asignación independiente por capítulo.

El Editor ejecuta. Jefe no tiene endpoints para registrar entregas, feedback de autor, Calidad, RRPP, Comercial ni asignación de Especialistas. Los guards se ejecutan en servidor; los UUID de otros dominios no resuelven como intervenciones de Edición. La propiedad se revalida bajo bloqueo al crear o entregar capítulos.

## Intervenciones, SLA y espera

`capitulo:<id>` identifica una instancia repetible de `work_items`. Crear/iniciar/entregar un capítulo y registrar feedback sincronizan esa instancia transaccionalmente. El contenedor `default` conserva la solicitud inicial y no se suma además de sus capítulos u otras intervenciones específicas. Capítulos legacy se proyectan desde la fuente original y materializan su work item al siguiente cambio normal; no se ejecuta una importación masiva.

El SLA normal de capítulo conserva la regla central existente: **tres días hábiles desde inicio registrado**, lunes a viernes, sin calendario de feriados inventado. No se asigna una fecha ficticia a un capítulo que aún no tiene inicio. `evaluarPlazoEdicion` es la regla común de vencimiento y riesgo; React sólo presenta el resultado.

- Entrega del Editor sin envío: **Esperando Especialista**, fuera de SLA activo del Editor.
- Enviado al autor sin respuesta: **Esperando autor**, aunque la fecha de feedback haya vencido. Esa demora requiere coordinación del Especialista, no una sanción al Editor.
- Feedback nuevo: reabre la misma intervención, preserva los eventos de entrega y vuelve a la cola con **Requiere ajustes**. No conserva el deadline de la edición anterior.
- El manual no fija un plazo independiente para aplicar feedback: se muestra sin fecha exigible hasta que exista una regla formal; no se inventan otros tres días.
- Entrega del feedback aplicado: completa la intervención y deja auditoría y aviso al Especialista. Entregas y feedback del mismo día también se auditan; repetir el mismo guardado no duplica el evento.

La proyección del Command Center reutiliza estas etiquetas, responsable, instancia y vencimiento, sin cambiar el estado macro del proyecto. El modelo de pausas generales del proyecto y sus métricas efectivas permanece en sus helpers anteriores; esta fase no introduce un calendario nuevo de reprogramación de SLA por pausas parciales.

## DTO, queries y métricas

Contrato compartido: `shared/editorialChief.ts`. Fuente: PostgreSQL. `GET /api/editores/inicio` hace **dos consultas**, independientemente de cuántos Editores existan: una proyección por lotes de intervenciones y una lectura del equipo activo. La actividad se consulta aparte para permitir error/reintento local. No hay query ni HTTP por Editor o fila, ni lectura Drive al renderizar.

Los joins y agrupaciones de autores, pedidos, solicitudes resueltas e historial vigente se realizan en CTE PostgreSQL. La agrupación descriptiva final y las reglas centrales de SLA se ejecutan en servidor; el navegador recibe resúmenes y listas acotadas, nunca toda la matriz para calcular los KPI. La lista de Seguimiento se filtra y pagina en servidor; sus agregaciones finales usan la misma proyección. Para volúmenes mayores conviene llevar también la paginación y distribución final a SQL, conservando las reglas centrales.

| Campo | Definición |
| --- | --- |
| Por asignar | Pedido explícito de Editor, no cancelado/completado, no resuelto por historial y sin Editor vigente; no todos los proyectos sin Editor |
| Entregas vencidas | Fecha exigible anterior al día Caracas e intervención accionable bajo responsabilidad de Edición |
| En riesgo | Fecha exigible igual a hoy, todavía accionable; señal objetiva documentada, sin umbral inventado de tres días |
| Solicitudes pendientes | Solicitudes nativas de Editor sin resolución; el único tipo de solicitud a Jefe soportado actualmente |
| Carga | Intervenciones accionables, entregas restantes hasta domingo, vencidas y esperas por Editor; sin ranking, porcentajes o capacidad inventada |
| Distribución | Cada intervención actual se cuenta una vez en su estado; no es progreso ni estado corporativo del proyecto |
| Atención | Por asignar, bloqueada, vencida, riesgo de hoy o feedback accionable; máximo seis en Inicio |
| Próximas entregas | Accionables, con fecha, no vencidas; máximo seis en orden ascendente |
| Solicitudes recientes | Pendientes dirigidas a Jefe, ordenadas por antigüedad, máximo cuatro |
| Actividad | Lista permitida de eventos de Edición desde `audit_logs`, seis registros; omite pagos, RRPP y Comercial |

`GET /intervenciones`, `/intervenciones/:id`, `/actividad`, `PATCH /asignaciones/:id` son exclusivos de `jefe_edicion`. `/mi-trabajo` y `/mi-trabajo/:id/entrega` son de Editor y filtran por la sesión. UUID ajeno, rol incorrecto, Editor inactivo/no Editor, proyecto cerrado y decisión obsoleta se rechazan.

## UX y navegación

Se reutilizan shell, marca, iconos, cuenta, campana y TanStack Query. Inicio presenta cuatro KPI, carga descriptiva, donut contextual, atención dominante, entregas, requests y actividad. No hay selector de mes, buscador global falso ni cubiertas inventadas. Los libros sin una portada renderizable usan un placeholder editorial.

Sidebar: Inicio, Asignaciones y carga, Proyectos de edición, Seguimiento, Solicitudes, Indicadores. Todos tienen destinos funcionales diferenciados: decisión y equipo, contexto agrupado de proyectos, supervisión filtrada, solicitudes y corte de distribución. Las exploraciones son el soporte mínimo de Inicio; no se presenta una digitalización completa de la matriz en seis pantallas.

**Historias que conectan.** es sólo pie institucional, sin enlace, icono, estado activo ni ruta. El drawer conserva foco, Escape y recuperación de errores. Asignar invalida Inicio, equipo, listas, detalle y las queries operativas relacionadas; no usa `location.reload`.

375 × 812: KPI 2 × 2 y filas convertidas en tarjetas, en el orden Atención → Próximas entregas → Carga → Solicitudes → Estado → Actividad. 768 × 1024: KPI 2 × 2 y paneles bajo el contenido principal. 1440 × 900: composición editorial con sidebar navy, acento gold y rail derecho.

## Asignaciones y carga

Pantalla de **decisión**, no de analítica ni de navegación general: responde "qué intervención necesita Editor y quién es la opción más adecuada según la carga real", nunca "qué pasó este mes" (eso es Indicadores) ni "cómo va el proyecto" (eso es Proyectos de edición). Implementación: `server/helpers/editorialAssignments.ts` (lecturas) + extensión de `asignarEditor` en `server/helpers/proyectos.ts` (decisión), rutas `GET /editores/asignaciones`, `GET /editores/equipo`, `GET /editores/intervenciones/:id/candidatos`, `PATCH /editores/asignaciones/:id` (ya existía; se extendió, no se duplicó).

**Sin flujo paralelo.** No existe una segunda consulta ni una "Matriz de Editores" renderizada literalmente: `listarAsignacionesEdicion`, `getEditorLoadSummary` y `recommendEditorsForIntervention` reutilizan `editorialInterventions` (la misma proyección canónica de Inicio/Mi trabajo/Seguimiento) como única fuente de verdad. El modelo de solicitud→asignación tampoco cambia: `EDITOR_SOLICITADO` (audit log) sigue siendo la única petición nativa; `asignarEditor` resuelve la solicitud y crea/reutiliza el work item de Edición dentro de la misma transacción, igual que antes de esta ronda.

**Unidad de asignación:** el proyecto. La asignación de Editor vive en `project_assignments` (`tipo='editor'`, `work_item_id IS NULL`); los capítulos (`capitulos`) heredan ese Editor, no reciben asignación individual — por eso `needsAssignment` excluye intervenciones con `chapter` no nulo. El panel lo declara explícitamente: "La asignación es por proyecto: incluye sus intervenciones de Edición vigentes."

**Carga, sin porcentaje inventado.** No existe capacidad máxima formal ni ponderación de complejidad para Editores (a diferencia de `servicios.pesoComplejidad` para Especialistas). Por eso la carga se presenta como conteos descriptivos — `activeAssigned`, `actionableNow`, `waitingThirdParty`, `overdue`, `dueThisWeek`, `nextDeliveries` (máximo 3) — nunca como `70%`/`Disponible`/`Saturado`. `waitingThirdParty` (espera de autor) se muestra como contexto de ocupación pero no cuenta como `actionableNow` ni puede quedar `overdue`.

**Recomendación determinista, nunca IA ni score.** `EDITORIAL_RECOMMENDATION_RULE = 'editorial-descriptive-v1'`: ordena por menos intervenciones accionables → menos vencidas → menos entregas esta semana → nombre (desempate estable). Devuelve `rank` + `reasons[]` (frases construidas desde los mismos hechos mostrados), nunca un `numericScore`. Empates comparten `rank` y se muestran todos — no se inventa un único "ganador". El Jefe puede elegir cualquier candidato elegible; la UI nunca bloquea ni exige seguir la sugerencia, y registra si la decisión fue manual (`manualOverride`) en el detalle de auditoría del evento `EDITOR_ASIGNADO`/`EDITOR_REASIGNADO`.

**Transacción, idempotencia y concurrencia.** `asignarEditor` sigue usando bloqueo de fila (`for('update')` en `proyectos`, y en el work item cuando la decisión referencia una intervención concreta) + `asignarConHistorial` (ya existente, compartido con el resto del dominio). Un `editorId` que no cambia nada (`cambio=false`) corta antes de auditoría/notificación — doble click no duplica. Concurrencia: `expectedEditorId`/`expectedAssignmentId` viajan desde el candidato mostrado en el panel; si el estado cambió entre abrir el panel y confirmar, la transacción rechaza con 409 y el frontend refresca candidatos en vez de crear una segunda asignación.

**Reasignación:** exige motivo (`motivoFin`, mínimo 5 caracteres) cuando ya existe Editor distinto al elegido. El historial completo vive en `project_assignments` (filas finalizadas conservan `finalizadoEn`/`motivoFin`); la fila vigente es la única con `finalizadoEn IS NULL`.

**SLA y pausas centralizados, no dispersos en React.** `plazoCapituloEditor`/`evaluarPlazoEdicion` (ya existían) se complementan con `ajustarPlazoEdicionPorPausas` (`server/helpers/edicionSla.ts`): desplaza la fecha exigible un día hábil por cada día de pausa de proyecto (`pausas`) dentro de la ventana, sin duplicar solapamientos ni borrar un atraso ya vencido antes de la pausa. Vive en el helper de dominio, no en componentes — ningún `if (EF) 3 días` disperso.

**Integración, no sistema duplicado:** Inicio (CTA de atención), la campana de notificaciones (`editorialRequestId` en `Notificacion`, deep link `?vista=asignaciones&request=<id>`) y Solicitudes reutilizan el mismo `EditorialDecisionDrawer`/`AsignarEditorCard`. Tras confirmar, se invalidan Inicio, equipo, listas, detalle, notificaciones, Mi trabajo del Editor y Project Command Center del Especialista — sin `location.reload`.

**RBAC/IDOR:** las cuatro rutas nuevas exigen `jefe_edicion`; `/intervenciones/:id/candidatos` valida que la intervención exista en el dominio de Edición (un `work_item` de otro tipo, por ejemplo `diseno`, responde 404). Filtros inválidos (UUID mal formado, `pageSize` fuera de catálogo) responden 400 desde el esquema zod, no se filtran solo en el cliente.

**Matriz de Editores → dominio** (sin tabla literal "Matriz de Editores"): fila de solicitud → `audit_logs(EDITOR_SOLICITADO)` + proyección de `editorialInterventions`; Editor/fecha de asignación → `project_assignments`; capítulo/Tripa/Kit → `capitulos`/`work_items.tipo='edicion'` existentes; fecha de entrega exigible → `work_items.fecha_fin_pautada` ajustada por pausas; feedback del autor → `capitulos.fecha_respuesta_real`. Ningún campo de la Matriz se copia o renderiza tal cual; todos se derivan de las tablas canónicas ya auditadas en la ronda de Inicio.

**Responsive:** tabs con scroll horizontal y filtros en overlay a 375×812; tarjetas de carga a una columna; el panel de decisión pasa a hoja de pantalla completa con el botón de confirmación fijo. A 768×1024 el panel es drawer lateral. Sin checkboxes de selección múltiple ni "Asignación rápida" con autoasignación — se auditó y se retiraron de la referencia visual por no corresponder a una regla real del dominio (ver `## Cobertura y siguientes fases` para huecos documentales no resueltos).

## Proyectos de edición

Pantalla para **comprender**, no para decidir ni ejecutar: "¿cómo está el proceso de Edición de cada proyecto y quién tiene la responsabilidad ahora?". Asignaciones decide, Seguimiento supervisa desvíos, Proyectos de edición explica. Implementación: `server/helpers/editorialProjects.ts` (`listarProyectosEdicion`, `obtenerProyectoEdicionDetalle`, `csvProyectosEdicion`), rutas `GET /editores/proyectos`, `GET /editores/proyectos/:projectId`, `GET /editores/proyectos/export.csv`. Reutiliza `editorialInterventions` (la misma proyección canónica de Inicio/Asignaciones) como única fuente; no crea un segundo modelo de proyecto ni una "Matriz de Editores" literal.

**Una fila = un proyecto** (nunca una intervención ni un work item): las filas de `editorialInterventions()` se agrupan en memoria por `projectId` y se sintetizan en un `EditorialProjectSummary`. Un proyecto con 10 work items históricos sigue siendo una sola fila.

**Estado de edición sintetizado, no macro del proyecto:** cuando hay varias intervenciones activas con estados distintos (ej. un capítulo esperando autor y otro en edición), se elige el estado más urgente según prioridad fija (`Bloqueadas > Requiere ajustes > En edición > Pendiente/Por iniciar > Esperando autor > Esperando Especialista > En pausa`), nunca el estado macro del proyecto (`proyectos.estado`). "Por iniciar" es un estado derivado del dominio (`work_items.estado='pendiente'` sin transicionar), no un enum inventado — ver `server/helpers/editorialInterventions.ts:20`: un capítulo nuevo nace `en_progreso` si el proyecto ya tiene Editor, o `pendiente` si no, así que "Por iniciar" solo aparece cuando el capítulo se creó antes de la asignación.

**Progreso, nullable a propósito y hoy siempre `null`:** no existe en el dominio actual un total de capítulos contractual confiable. `fichas_trazabilidad.capitulos_pactados` es texto libre con un rango (`'11 a 20'`, ver comentario en `server/db/schema/trazabilidad.ts:61-70`), nunca un entero — mostrar `5/12` inventaría un denominador que no existe. El DTO conserva `progress: {completedUnits,totalUnits,unitLabel} | null` para cuando (si alguna vez) exista un total real, pero hoy el campo siempre resuelve `null`; en su lugar, `interventionSummary` describe conteos reales sin fracción ("6 capítulos registrados · 2 completados", o la etiqueta de la intervención única para Tripa/Kit/SE).

**Editor actual y múltiples Editores:** viene exclusivamente de `project_assignments`/`proyectos.editor_id` vía `editorialInterventions`, nunca de un campo manual. Si distintas intervenciones del mismo proyecto tienen Editores distintos (`editorCount>1`), la fila no inventa un único responsable: muestra "N Editores" y el detalle por intervención queda en la pestaña Intervenciones.

**Responsable actual** (`responsibleNow`): dimensión separada del estado — `editor` cuando el estado es accionable por Edición, `autor` en Esperando autor, `especialista` en Esperando Especialista, `null` en pausa/completado. Nunca se interpreta una espera de autor como atraso del Editor.

**Siguiente paso:** texto narrativo derivado del estado sintetizado y la intervención más urgente (`NEXT_STEP` en `editorialProjects.ts`), no texto libre inventado; si hay bloqueo explícito (`gate_bloqueante`), ese mensaje tiene prioridad.

**Intervenciones (pestaña):** hasta 10 más relevantes (accionables primero, luego por fecha), con enlace "Ver todas (N) en Seguimiento" cuando hay más — Proyectos de edición nunca pagina cientos de intervenciones en el panel.

**Archivos (pestaña):** usa `workspaceSummaries`/`projectDriveFolders` con las `key` reales de la plantilla de Edición (`EDITING_OUTPUT`, `FULL_MANUSCRIPT`, `EDITORIAL_KIT`, `EDITING_FEEDBACK` — ver `server/modules/project-workspaces/templates.ts:23-29`), nunca una ruta hardcodeada. Sello editorial (SE) no genera subárbol `EDITING` en absoluto (`if(key!=='SE')` en `templates.ts:23`): un proyecto SE con intervención de Edición registrada puede legítimamente no tener archivos de Edición en Drive, y la pestaña muestra el vacío honesto ("Este proyecto aún no tiene espacio documental de Edición disponible"), no un error.

**Historial (pestaña):** mismo catálogo `EDITORIAL_EVENTS` que Asignaciones/Inicio (`EDITOR_SOLICITADO`, `EDITOR_ASIGNADO`, `EDITOR_REASIGNADO`, `CAPITULO_EDITOR_ENTREGADO`, `CAPITULO_ENVIADO_AUTOR`, `CAPITULO_FEEDBACK_REGISTRADO`, `CAPITULO_FEEDBACK_APLICADO`, `FEEDBACK_TRIPA_REGISTRADO`), filtrado por proyecto, máximo 10. No se audita "Jefe abrió el proyecto".

**Integración, no sistema propio:** "Asignar Editor →" y "Ver en Seguimiento →" son enlaces a `/?vista=asignaciones` y `/?vista=seguimiento-edicion` con `search=<código>` — el mismo patrón ya usado por el panel de Asignaciones, no una acción nueva. Esta pantalla no permite operar el trabajo del Editor (no hay "marcar entregado" ni "aprobar feedback" aquí).

**KPI (4, del conjunto completo filtrado, no de la página actual):** Proyectos en edición, Con entregas próximas, Con intervenciones vencidas, En espera de autor — los tres últimos cuentan **proyectos** con al menos una intervención en esa condición, nunca intervenciones individuales.

**Filtros y estado en URL:** búsqueda server-side con debounce 300 ms (proyecto/autor/Editor), servicio (catálogo real, sin desglosar Crudo por subtipo en el filtro), estado de edición (derivado, no enum manual) y Editor; orden por última actividad/próxima entrega/título/estado/Editor; página/tamaño en `10|25|50`. Selección de fila (`?project=<id>`) persiste en URL y admite deep link desde Inicio/notificaciones.

**Panel derecho no modal:** a diferencia del drawer de decisión de Asignaciones (una acción que requiere foco), el Quick View de Proyectos de edición es un panel lateral persistente (split-pane, sticky en desktop) que no bloquea la lista — explorar no es decidir. Se oculta por completo sin selección; en móvil (≤600px) pasa a pantalla completa.

**Exportación:** CSV (mismo patrón sin dependencias que Indicadores/Asignaciones: BOM, CRLF, celdas con prefijo de fórmula neutralizado). Columnas: Proyecto, Autor, Servicio, Editor actual, Estado de edición, Intervención actual, Próxima entrega, Última actividad — sin teléfonos, emails ni payloads de auditoría.

**RBAC/IDOR:** las tres rutas exigen `jefe_edicion`; un `projectId` sin intervenciones de Edición responde 404 (no expone proyectos fuera del dominio de Edición).

## Cobertura y siguientes fases

No hay capacidad máxima formal, calendario de feriados ni SLA específico de aplicación de feedback. Tampoco existen requests nativas independientes de reasignación/apoyo de Edición: se reutiliza la reasignación con motivo y no se inventan tipos de solicitud. Tripa, kit, estructura y extracción conservan el modelo/configuración vigente; esta fase no crea tareas automáticas ni divide contenido sin registro real.

Indicadores completos —producción por Editor, completadas por período y récord general— quedan para su fase histórica. La pantalla Indicadores enlazada informa el corte operativo disponible sin simular esos históricos. No se agregaron dependencias ni un motor de workflow nuevo.

Validación y evidencia: `docs/auditoria/29-jefe-edicion-validacion.md` y `docs/evidencias/jefe-edicion/`.
