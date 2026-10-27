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
| GAP, fin de edición, días y total real de ejecución | Plazos y hechos canónicos; no fórmulas copiadas | Indicadores (ver sección § Indicadores) |

La matriz es una vista operativa. No se creó una tabla espejo, ni se importaron sus filas o nombres. EF y Crudo se leen del catálogo y subtipo de ficha. Sello no recibe Editor automáticamente: el comando exige una intervención de Edición previamente registrada.

## Ownership y transacciones

1. El Especialista asignado solicita Editor por el comando existente `solicitarEditor`.
2. El pedido conserva `EDITOR_SOLICITADO` y el trabajo de Edición. La revisión de Solicitudes materializa su decisión en la tabla compartida `solicitudes_area`, con estado independiente del trabajo y conservando los IDs nativos (ver sección Solicitudes).
3. Jefe de Edición decide mediante un único drawer compartido por Inicio, Asignaciones y Solicitudes.
4. `asignarEditor` bloquea el proyecto, valida Editor real/activo, usa `asignarConHistorial`, mantiene el puntero, registra auditoría y notificaciones en la misma transacción.
5. La transacción de asignación resuelve `solicitudes_area` y activa el trabajo; el historial conserva el resultado. No queda una request pendiente junto al trabajo asignado.
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

**Sin flujo paralelo.** No existe una segunda consulta ni una "Matriz de Editores" renderizada literalmente: `listarAsignacionesEdicion`, `getEditorLoadSummary` y `recommendEditorsForIntervention` reutilizan `editorialInterventions` (la misma proyección canónica de Inicio/Mi trabajo/Seguimiento) como única fuente de verdad. El origen sigue siendo el pedido explícito `EDITOR_SOLICITADO`; la revisión de Solicitudes separa su estado en `solicitudes_area`. `asignarEditor` resuelve esa request y crea/reutiliza el work item de Edición dentro de la misma transacción.

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

## Seguimiento

Pantalla de **supervisión operativa**, no de decisión ni de explicación agregada: "¿qué intervenciones de Edición se están desviando, venciendo, bloqueando o requieren supervisión?". Asignaciones decide quién lo hace, Proyectos de edición explica el proyecto completo, Seguimiento supervisa cada intervención. Implementación: `server/helpers/editorialTracking.ts` (`listarSeguimientoEdicion`, `obtenerSeguimientoDetalle`, `csvSeguimientoEdicion`), rutas `GET /editores/seguimiento`, `GET /editores/seguimiento/:id`, `GET /editores/seguimiento/export.csv`. Misma fuente canónica (`editorialInterventions`) que Asignaciones/Proyectos de edición; cero queries nuevas al dominio.

**Unidad = intervención/work item, nunca proyecto** (a diferencia de Proyectos de edición): el mismo proyecto puede — y debe — aparecer varias veces, una fila por capítulo/intervención activa. No hay agregación en memoria aquí, solo filtro + orden + paginación sobre `editorialInterventions()`.

**Sin "Por asignar" ni botón "Asignar":** `listarSeguimientoEdicion` excluye explícitamente `needsAssignment` desde la primera línea — esas intervenciones pertenecen exclusivamente a Asignaciones y carga. La columna Acciones ofrece "Ver seguimiento", nunca "Asignar"; Seguimiento no implementa su propio flujo de asignación.

**Responsable actual ≠ Editor asignado:** `EDITORIAL_RESPONSIBLE` (compartido con Proyectos de edición, `server/helpers/editorialChief.ts`) deriva `currentResponsible` (`editor`/`autor`/`especialista`/`null`) desde el estado real de la intervención — un Editor puede seguir asignado mientras la responsabilidad activa es del autor (esperando feedback) o del Especialista (esperando que gestione la entrega). Es una columna propia en la tabla, no un dato enterrado en texto pequeño, y también filtrable.

**Vencida/en riesgo, con la misma fórmula central que ya usaban Asignaciones y Proyectos de edición** (`evaluarPlazoEdicion`, `server/helpers/edicionSla.ts`): `overdue = accionable && fecha < hoy`, `atRisk = accionable && fecha === hoy`. Ningún umbral nuevo, ningún `if (daysRemaining <= 3)` en React. Esperando autor/Especialista/pausa de proyecto **nunca** cuentan como vencidas del Editor — se verificó explícitamente en tests que una intervención `Esperando autor` con deadline original ya superado no aparece en el tab Vencidas ni en su KPI.

**Columna "Días" con contexto, nunca un número crudo:** `diasLabel()` devuelve "Vence hoy", "N días", "Vencida hace N días", "Pausado" (pausa formal de proyecto) o "SLA en pausa" (esperando autor/Especialista) — jamás "-3" sin explicación.

**Bloqueada: solo con `gate_bloqueante` explícito**, nunca inferido de inactividad ("no se movió hace N días" no existe como señal en este sistema). El panel de detalle muestra el motivo real tal cual está en el dominio.

**KPI (4, del conjunto completo filtrado):** Vencidas, En riesgo, Bloqueadas, Esperando terceros — "Completadas" queda fuera de los KPI principales (pertenece a Indicadores); el tab "Todas" sigue siendo el único lugar donde aparecen.

**Tab "Prioritarios"** (default): combina Vencidas ∪ En riesgo ∪ Bloqueadas como un filtro compuesto, sin persistir un estado nuevo — es pura composición de los mismos booleanos ya centralizados. El resto de tabs (Vencidas, En riesgo, Bloqueadas, En edición, Esperando terceros, Todas) son vistas directas sobre dimensiones reales del dominio.

**Panel derecho centrado en la intervención, no en el proyecto:** el resumen muestra responsabilidad actual de forma prominente, tipo, Editor asignado, Especialista, deadline/tiempo, motivo de riesgo/bloqueo (solo si existen) y siguiente paso narrativo. El contexto del proyecto es secundario: cover + título + autor en el header, y hasta 6 "otras intervenciones de este proyecto" como lista compacta al final, con link a Proyectos de edición para el detalle completo — nunca domina el panel.

**Historial, acotado a la intervención real:** se filtra `audit_logs` por `entity_id IN (id de la intervención, work_item_id, capítulo real si aplica)`, no todo el historial del proyecto — los eventos de capítulo (`CAPITULO_*`) usan `entity_id` = id del capítulo real (resuelto por `proyecto_id`+`numero`, ver `server/db/schema/capitulos.ts`), no el id compuesto que expone la proyección.

**Archivos:** para intervenciones de capítulo, `capitulos.enlaces` (URLs reales registradas "de esa vuelta" — único campo de archivo por capítulo que existe en el dominio hoy) se muestra primero, seguido de los enlaces generales de la carpeta de Edición del proyecto (misma resolución por `folderKey`/`workspaceId` que Proyectos de edición, reexportada como `editorialDriveLinks`). Sin workspace o sin `enlaces`, vacío honesto — nunca un explorador Drive completo.

**No se opera el trabajo del Editor desde aquí:** sin "marcar entregado", "completar capítulo" ni "aplicar feedback" — Ver ≠ Operar. Las únicas acciones son "Ver en proyecto →" (Proyectos de edición) y "Reasignar →" (reutiliza Asignaciones y carga vía `search=<código>`, mismo patrón ya usado en los otros dos módulos; no hay un segundo flujo de asignación).

**Filtros y orden:** búsqueda server-side con debounce 300 ms, servicio, estado, Editor, responsable actual, tipo de intervención, rango de fechas; orden por fecha límite (default, con desempate por severidad: vencidas > bloqueadas > en riesgo > resto), estado, Editor o proyecto. "Última actividad" no es una opción de orden: no existe ese dato a nivel de intervención individual sin introducir N+1, así que se omitió en vez de aproximarlo.

**Exportación respeta los filtros activos** (a diferencia de Proyectos de edición, cuyo CSV exporta el universo completo) — mismo patrón CSV sin dependencias. Columnas: Proyecto, Autor, Intervención, Servicio, Editor, Responsable actual, Estado, Fecha límite, Desvío.

**RBAC/IDOR:** las tres rutas exigen `jefe_edicion`; un `id` sin intervención operativa real (o `needsAssignment`) responde 404.

## Solicitudes

Actualización: 23 de octubre de 2026. Bandeja de decisiones del rol existente `jefe_edicion`: quién solicita, qué proyecto/intervención afecta y dónde se ejecuta la decisión.

### Fuentes y alcance real

Se revisaron el manual local del Especialista, las auditorías y arquitectura existentes, solicitudes del Especialista, `solicitudes_area`, `work_items`, `project_assignments`, eventos, notificaciones, Asignaciones, Seguimiento y cola del Editor. En esta revisión no están disponibles los originales de la Matriz de Editores ni del PPTX de Indicadores; la documentación previa y `docs/auditoria/indicadores-fuente-2026-08.json` conservan su procedencia. No se importaron cifras ni personas de esos documentos o de la imagen.

**Mapa de requests real:** `ASSIGN_EDITOR` / `tipo='editor'` → Especialista asignado al proyecto → Jefe de Edición, por rol → proyecto con intervención válida y pedido explícito → comando central `asignarEditor` → asignación formal, trabajo activo, resultado, auditoría y notificaciones. No hay destinatario individual de Jefatura en el dominio actual: el alcance es el conjunto de proyectos de Edición, no RRPP/Creativa/Comercial.

No se inventaron requests de Reasignación, Escalación ni Apoyo por carga: no tienen origen formal en el negocio implementado. La reasignación real sigue en Asignaciones y carga con motivo e historial; un bloqueo se supervisa en Seguimiento y no se convierte automáticamente en escalación. No hay prioridad ni SLA de respuesta inventados.

### Request y trabajo tienen estados distintos

Se reutiliza **`solicitudes_area`**, sin tabla paralela ni motor nuevo. `0087_editor_request_lifecycle.sql` amplía su CHECK de tipos para `editor` y materializa solicitudes nativas preexistentes a partir de hechos registrados. Conserva solicitante, fecha y el ID público anterior (`work_item.id`), para no romper enlaces. Compartir ese UUID de compatibilidad no une las entidades: la decisión vive en `solicitudes_area`; la ejecución vive en `work_items`. Una lectura nunca migra ni modifica estado. Los registros legacy sin actor superviviente se leen de los hechos previos sin fabricar un solicitante; no se ofrece devolución sin destinatario rastreable.

`businessKey`: la clave canónica del trabajo; pedido inicial `default`. Unicidad por `(proyecto_id,tipo,business_key)`, más bloqueo del proyecto al solicitar, evita duplicados concurrentes.

Lifecycle mínimo: **Pendiente → Resuelta**, o **Pendiente → Devuelta → Pendiente**. Devuelta usa el estado existente `requiere_informacion`; no se agrega un enum. Cancelaciones nativas se muestran como Cancelada, sin nuevo comando de cancelación. Abrir detalle no genera “en revisión”.

`POST /editores/solicitudes/:id/devolver` exige motivo de 5–1000 caracteres y `expectedVersion`. Bloquea proyecto y request, comprueba rol, estado y versión; guarda motivo, incrementa versión, audita y notifica al solicitante dentro de una transacción. No completa ni cancela el trabajo. El Especialista ve `requiere_informacion`, motivo e historial en su bandeja. Puede reenviar mediante el comando existente `solicitarEditor`; conserva request y fecha originales, registra reenvío y notifica al Jefe. No duplica el evento inicial.

### Resolución central y consistencia

`asignarEditor` mantiene el orden de bloqueo **proyecto → solicitud → trabajo**, compartido con devolución. Revalida Editor activo, alcance, gates, asignación esperada, `expectedRequestVersion` y estado de la solicitud. Asignación, request resuelta, trabajo creado/activado, historial, auditoría y notificaciones se confirman juntos. Retry con el mismo Editor no duplica resultados. Dos decisiones distintas o devolver/asignar concurrentes dejan un solo resultado y un conflicto 409 para la segunda; el frontend actualiza el contexto.

La primera asignación formal posterior al pedido es el resultado histórico; una reasignación posterior no lo reescribe. El DTO entrega `resultAssignmentId`, `resultEditorId`, `resultWorkItemId`, responsable y fecha reales. Se conserva el historial aunque cierre el proyecto. El detalle correlaciona el ID de la solicitud/trabajo con el **ID de project_assignment**: ya no pierde el evento de resolución por exigir que todos compartan entityId.

### Contratos de lectura y rendimiento

`GET /editores/solicitudes`: una consulta SQL con joins, filtros, conteos, opciones, orden, LIMIT y OFFSET. Una fila = una request, sin queries por proyecto, autor o solicitante. Búsqueda parametrizada y sin distinguir tildes por proyecto, autor, código, solicitante, intervención y notas; `%` y `_` se tratan como texto literal. Servicio, solicitante y rango de fechas; días según **America/Caracas**, no UTC. Rango invertido devuelve 400. Orden estable por fecha antigua/reciente o proyecto, con desempate por ID. Paginación validada: 10/25/50, página fuera de rango se ajusta al límite.

El KPI `pendingTotal` no depende de filtros: solo pendientes **accionables**, coincidente con Inicio y badge del sidebar. Los conteos de tabs sí reflejan el conjunto filtrado completo, no la página. Devueltas e históricas no inflan Pendientes. Una request con pausa o gate sigue pendiente de decisión y puede devolverse: `actionable` controla la bandeja y `assignmentReady` controla exclusivamente el CTA/recomendación de asignación. No pasa a Por asignar hasta liberar los gates. Inicio distingue ambos conteos conservando dos consultas. Pendientes es la vista inicial.

`GET /editores/solicitudes/:id`: consulta directamente esa request; no carga todo el inbox. Contexto, archivos e historial solo se consultan para la seleccionada. Hasta seis lecturas de dominio, constantes respecto de filas: resumen, intervención, Especialista, historial y dos consultas de carga. Sin HTTP externo ni Drive durante el render.

`recommendationSummary` consume **`getEditorLoadSummary` + `recommendEditorsForIntervention`**, regla compartida `editorial-descriptive-v1`. Devuelve solo un resumen y el número de empates, nunca lista/radios ni otro algoritmo. No se confunde la recomendación descriptiva con capacidad o disponibilidad formal.

Archivos: solo el enlace HTTPS al manuscrito canónico del proyecto relacionado con el pedido inicial. Sin explorador de Drive ni archivos de otras áreas. El dominio no almacena notas propias del solicitante ni volumen contractual numérico para el inicio: no se fabrican. Las notas operativas registradas se identifican como tales.

### UX e integraciones

Composición editorial con sidebar navy, branding en el pie, título serif, KPI pendiente, guía, filtros, tabs y tabla dominante. No hay KPI principal de Resueltas ni tabs de tipos inexistentes. Seleccionar fila conserva página y actualiza panel derecho, sin navegar. Estado de filtros, tab, página, selección y pestaña del detalle en URL. Fechas Hoy/Ayer incluyen hora Caracas.

Detalle: **Resumen / Contexto / Archivos / Historial**. Resuelta es de solo lectura y muestra resultado y enlace al trabajo si sigue visible en Seguimiento. Si el contenedor dio paso a capítulos, el enlace muestra las intervenciones del proyecto; proyectos cerrados conservan el resultado sin enlaces a exploradores de activos. El contexto puntual puede ser nulo cuando el contenedor ya fue reemplazado visualmente por capítulos; se explica y se ofrece Proyectos de edición. “Ver en proyecto” selecciona ese proyecto; no abre Ficha.

“Revisar y asignar Editor” y “Ver comparación completa” navegan a `?vista=asignaciones&request=<workItemId>&originRequest=<requestId>` y abren el **mismo EditorialDecisionDrawer**. Se desmonta el detalle antes de abrir la decisión: no hay modal sobre modal ni selector propio. Tras asignar, se vuelve al detalle de la request resuelta.

Se invalidan TanStack keys reales: Edición, equipo, listas/detalles, cola, proyecto, ficha, workspace, `solicitudes`/`solicitud` del Especialista, Mi trabajo y notificaciones. No hay reload. Actividad independiente desde audit_logs, máximo cuatro eventos, con error/reintento local.

Desktop: tabla y panel lateral de 344px; tablet: drawer y fondo; móvil: tarjetas y detalle de pantalla completa, scroll del fondo bloqueado, Escape y contención de foco. CSS para 1440/768/375; **la inspección visual real de esta ronda quedó bloqueada por Computer Use**, que no pudo verificar la URL de Chrome. No se afirma QA visual, capturas o comparación final que no se realizaron.

Todas las rutas de consulta y devolución exigen sesión y `jefe_edicion`; IDs de requests/work items de otros dominios devuelven 404. El Especialista solo puede reenviar en su proyecto. Jefe no entrega, sube archivos, aplica feedback, asigna Especialistas ni opera otras áreas desde Solicitudes.

Pruebas y resultados de esta revisión: `docs/auditoria/29-solicitudes-edicion-validacion.md` y `docs/evidencias/jefe-edicion/solicitudes-*.json`.

La regresión completa detectó además un desajuste previo entre el cierre creativo en UTC y los indicadores diarios de Caracas. Las fechas generadas de cierre y aprobación RRPP en `direccionCreativa.ts` ahora reutilizan `diaCaracas`; una prueba de cambio de día y la revalidación de los flujos creativos verifican la corrección. No se modifican permisos ni procesos de esa área.

## Indicadores

`GET /api/editores/indicadores` y `GET /api/editores/indicadores/export.csv` (`requireRole('jefe_edicion')`). Analítica agregada del área de Edición: responde "qué está pasando en volumen, cumplimiento, tiempos y desviaciones" — nunca "qué necesita mi atención hoy" (eso es Inicio/Asignaciones/Seguimiento/Solicitudes). Catálogo de métricas, fórmulas y población: ver [docs/arquitectura/09-metrics-map.md §3](./09-metrics-map.md). Implementación: `server/helpers/editorialIndicadores.ts`.

**Alcance:** toda el área de Edición, sin recorte de "mi propia asignación" (a diferencia de Líder Creativo) — Jefatura de Edición ve el conjunto completo de proyectos e intervenciones de Edición. Pasar `service`/`editor`/`interventionType` como filtro **nunca** amplía el alcance ni evita RBAC: son recortes dentro del mismo dominio autorizado, nunca un parámetro que abra datos de otra área.

**Dos fuentes, nunca mezcladas:**

- **Corte actual (snapshot):** reutiliza `editorialInterventions()`, el mismo read-model que Inicio/Asignaciones/Proyectos de edición/Seguimiento, restringido a proyectos con estado activo (`en_proceso`, `retrasado`, `stand_by`, `pausado`). De aquí salen `projectsInEditing`, `overdueInterventions`, `waitingAuthor`, la distribución por estado, el desglose "activas/vencidas/vencen esta semana/esperando terceros" por Editor, el desglose por servicio y la tabla de proyectos en riesgo.
- **Histórico/período (`historiaCompletadas()`):** consulta capítulos (`fecha_entrega_editor IS NOT NULL`) y work_items de Edición completados **sin** restringir por el estado actual del proyecto — un proyecto puede haberse cerrado desde entonces y la entrega sigue siendo real. De aquí salen `completedDeliveries`, las entregas/SLA por Editor y el tiempo de ciclo. El Editor atribuido a cada fila histórica es el que estaba vigente **al momento del cierre** (`project_assignments` con `asignado_en <= completed_at`), no el Editor actual del proyecto — una reasignación posterior no reescribe quién entregó qué.

Ambas fuentes reutilizan exactamente las mismas reglas de `server/helpers/edicionSla.ts` (3 días hábiles para capítulo EF/Crudo, ajuste por pausas vía `ajustarPlazoEdicionPorPausas`) — nunca un segundo cálculo de SLA paralelo ni una regla aplicada a ciegas a cualquier tipo de intervención.

**Plazo honesto, nunca fabricado:** `historiaCompletadas()` distingue "el work_item nunca se sincronizó" (ahí sí reconstruye un plazo de respaldo a partir del inicio registrado) de "el work_item existe y a propósito no tiene plazo" — el caso real es la aplicación de feedback sobre un capítulo: `sincronizarCapituloEditorial` deja `fecha_fin_pautada = NULL` porque el manual no define SLA para esa segunda vuelta. Antes de esta ronda, el `??` de respaldo no distinguía ambos casos y resucitaba un plazo fabricado a partir del inicio original, atribuyendo a Edición un tiempo de espera que no le correspondía; se corrigió añadiendo `has_work_item` a la consulta y usándolo como guarda explícita. Cubierto por la prueba "SLA honesto" en `tests/editorialIndicadores.test.ts`.

**KPI (máximo 4):** `Proyectos en edición` (snapshot, proyectos distintos — nunca intervenciones), `Entregas completadas` (período, con comparación), `Intervenciones vencidas` (snapshot, solo responsabilidad de Edición) y `En espera de autor` (snapshot, señal operacional neutra). Solo `Entregas completadas` compara contra el período anterior equivalente (`cambio()`, `null` si el anterior es cero, nunca `+∞%`); los otros tres son corte de hoy y se etiquetan explícitamente "Corte actual" en vez de simular una comparación que no existe.

**Estado de las intervenciones editoriales (donut):** distribución del snapshot actual por `EditorialState`, nunca progreso del período ni avance acumulado. No incluye "Completadas" — esa es una noción de período, no de corte actual.

**Intervenciones por semana:** Iniciadas/Completadas se leen del histórico (fecha de inicio real / fecha de cierre); Vencidas se lee del snapshot actual agrupando por la semana de su `dueDate` vencido — no existe un registro histórico de "cuándo se volvió vencida", así que esta serie mezcla deliberadamente una proyección de hoy con el histórico del período, y así se documenta en el tooltip.

**Actividad del equipo editorial:** columnas de hechos (activas, vencidas, vencen esta semana, esperando terceros, entregas completadas, cumplimiento SLA) — sin ranking, sin medallas, sin score, sin "mejor Editor". Cumplimiento SLA excluye del denominador toda entrega sin plazo aplicable y reporta "Sin datos" (nunca `0%`) cuando no hay muestras comparables.

**Tiempo de ciclo por tipo de intervención:** promedio de días bajo responsabilidad de Edición — desde el inicio registrado del Editor hasta su entrega, sin descontar la espera del autor (esa espera es una intervención aparte, "Esperando autor", no un descuento sobre el tiempo de Edición). Tipos reales (`chapter`, `step:<nombre>`), nunca las etiquetas del mockup de referencia (Capítulo EF/Crudo/Tripa completa/Kit editorial) si no coinciden con el catálogo vigente. Sin muestras, `null`/"Datos insuficientes".

**Intervenciones activas por servicio:** snapshot actual agrupado por `servicios.nombre` real, nunca una lista fija EF/EEC/EET/SE que pueda haber quedado desactualizada frente al catálogo vigente.

**Proyectos con trabajo editorial en riesgo:** única tabla donde una fila = un proyecto (no una intervención) — cuenta cuántas de sus intervenciones están en riesgo (`overdue`, `atRisk` o `Bloqueadas`), la próxima entrega no vencida más cercana y el estado editorial sintetizado por `projectState()` (exportada de `editorialProjects.ts`, misma prioridad de estados que Proyectos de edición). Máximo 8 proyectos.

**Actividad reciente:** reutiliza `editorialActivity()` (mismo feed de Inicio) — eventos de `audit_logs` exclusivamente del dominio de Edición, nunca RRPP/Comercial/Pago/Dirección Creativa. Máximo 8.

**Filtros:** período (los 6 presets del prompt — Este mes, Mes anterior, Últimos 3/6 meses, Este año, Personalizado — nunca un mes fijo como "Agosto 2026"), servicio, Editor y tipo de intervención. Snapshot e histórico comparten la misma población filtrada, así que un filtro afecta de forma consistente a todos los widgets que lo admiten; ningún widget lo aplica "a medias". Las listas de opciones del filtro (`filters.services/editors/interventionTypes`) provienen del snapshot **sin filtrar**, para que nunca se reduzcan a una sola opción tras elegirla.

**Exportación:** CSV (`csvIndicadoresEdicion`, mismo patrón sin dependencias que `indicadoresJefatura.ts`/`creativeIndicadores.ts`: BOM, CRLF, celdas con prefijo de fórmula neutralizado). No hay infraestructura XLSX/PDF en el proyecto — no se agrega un botón con exportación defectuosa solo por tenerlo. Respeta período y filtros activos; mismo RBAC que la pantalla (nunca un endpoint público).

**Mapeo de términos legacy del PPTX** (`INDICADORES AGOSTO 2026.pptx`, estatus general y récord por Editor): "Pausados"/"Stand-by" del PPTX corresponden al `waitingOn`/estado `En pausa` ya modelado (ver tabla de Mapeo de la matriz arriba); "Retrasados" corresponde a `overdue` bajo responsabilidad de Edición. El PPTX no define una fórmula de "Estatus general" ni de "Récord General" por Editor más allá de un conteo visual mensual — no hay cifra ni fórmula ponderada que auditar y confirmar como oficial, y esta pantalla deliberadamente no reconstruye un "récord" o ranking a partir de esos datos (ver Prohibiciones abajo). Cualquier equivalencia adicional que no esté ya confirmada por código o por esta tabla queda `PENDIENTE_VALIDACION_DOCUMENTAL`, nunca asumida porque "suena lógica".

**Prohibido explícitamente:** score/porcentaje de productividad, ranking o "mejor Editor"; copiar el GAP general de Jefatura (Seguimiento editorial ya tiene sus propios plazos); recomputar SLA/plazos fuera de `edicionSla.ts`; atribuir espera de autor/Especialista como vencimiento de Edición; porcentaje `+∞%`; `0%` cuando el denominador es cero (debe ser "Sin datos"); cifras del mockup de referencia (28/18/6/3/64/22/14/11/5/3/9/3.2/4.1/6.8/2.9/5.0/88%/100%/71%) hardcodeadas en cualquier parte del código.

**Pruebas:** `tests/editorialIndicadores.test.ts` (backend: RBAC, validación, conteo de proyectos distintos, límites de período, comparación sin base, espera de autor vs. vencida, SLA honesto con exclusión de ciclos sin plazo, ciclo sin muestras, riesgo por proyecto, filtros consistentes, IDOR, CSV, HTTP) y `frontend/src/jefeEdicion/editorialIndicadores.test.tsx` (header sin fecha fija, máximo 4 KPI, snapshot vs. período, tabla sin ranking, definición de ciclo visible, estados vacíos, error con reintento).

## Cobertura y siguientes fases

No hay capacidad máxima formal, calendario de feriados ni SLA específico de aplicación de feedback más allá de "sin plazo aplicable" (ver § Indicadores). Tampoco existen requests nativas independientes de reasignación/apoyo de Edición: se reutiliza la reasignación con motivo y no se inventan tipos de solicitud. Tripa, kit, estructura y extracción conservan el modelo/configuración vigente; esta fase no crea tareas automáticas ni divide contenido sin registro real.

Indicadores completos —producción por Editor, completadas por período y cumplimiento SLA— ya están implementados (ver § Indicadores arriba). Deliberadamente no se reconstruyó un "récord general" ni un ranking por Editor: el PPTX histórico no define esa fórmula de forma auditable, y el prompt que originó esta fase prohíbe explícitamente inventar un score. No se agregaron dependencias ni un motor de workflow nuevo.

Validación y evidencia: `docs/auditoria/29-jefe-edicion-validacion.md` y `docs/evidencias/jefe-edicion/`.


## Integración con el espacio del Editor — 26 de octubre de 2026

La bandeja incluye ahora `editor_apoyo` y `editor_reasignacion`, además de la asignación inicial `editor`. Estos pedidos son decisiones con respuesta; no se presentan como nuevas solicitudes de asignación. Se pueden revisar, devolver para completar o resolver con resultado y notificación al Editor. La reasignación efectiva conserva el comando y el historial existentes. Las aclaraciones se dirigen al Especialista actual. La especificación y el mapa de propiedad compartido están en [30-editor.md](./30-editor.md), que actualiza las limitaciones de solicitudes descritas en las fases anteriores de este documento.
