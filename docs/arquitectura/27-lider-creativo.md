# 27 · Líder Creativo: Inicio operativo

Fecha: 19 de octubre de 2026. Rol técnico existente: `lider_creativo`. Área visible: Dirección Creativa.

## Fuentes y auditoría previa

Se revisaron el estado/diff/log de Git, roles y usuarios reales, HomePage, navegación, Ficha viva, project assignments, work items, gates, notificaciones, auditoría, Dirección Creativa, RRPP, Diseño y workspace Drive antes de implementar. El árbol estaba limpio sobre `c8089dd` (automatización del workspace al asignar Especialista).

Fuentes locales de negocio:

- `fuentes-negocio/Proceso de adiestramiento - Especialista editorial (3).docx`: definición de título, reunión grabada/transcrita, Brief elaborado por Líder, validación del autor gestionada por Especialista, 2–3 conceptos, checkpoint RRPP, feedback, imagen/Freepik + concepto PDF, ejecución por Diseño y verificación creativa de cubierta. También actualización de activación por servicio.
- `fuentes-negocio/DIRECCIÓN CREATIVA.xlsx`: 19 hojas. La matriz general registra autor, título, servicio, Especialista, reunión, Brief entregado/aprobado, propuestas enviadas/aprobadas, autor, observaciones y enlaces. Las fórmulas de días comparan hitos (por ejemplo H−E y L−H), con variantes históricas. No definen un SLA de producción ni una prioridad formal para este Inicio.
- Documentos 05, 10, 12, 13 y auditorías existentes. Algunos documentos históricos decían que la matriz no estaba disponible o compartían Diseño con el Líder; este documento registra el estado actual comprobado.

La imagen de referencia guía composición y densidad. Sus números, autores, libros, fechas y portadas no se usan como datos.

## Ownership y gates

| Responsable | Trabajo |
|---|---|
| Especialista | Solicita Dirección Creativa, coordina autor, registra envío/aprobación/feedback del Brief y conceptos y coordina Diseño. |
| Líder Creativo | Reunión/contexto, Brief, 2–3 conceptos, ajustes, recursos del concepto aprobado y verificación creativa de cubierta. |
| RRPP | Aprueba o devuelve conceptos antes de enviarlos al autor. No es dueño del Brief ni de la conceptualización. |
| Diseñador | Ejecuta cubierta extendida y sus correcciones, además de su propio flujo de diagramación. |
| Edición / Calidad | Conservan controles internos independientes. La verificación creativa no los completa. |

Se reutilizan GATE-07 (título/subtítulo y momento por servicio), gate de Brief aprobado para conceptualizar y GATE-05 de aprobación RRPP antes de comunicación al autor. EF/CR requieren el feedback de tripa completa definido por el dominio; SE puede solicitar desde ingreso/reunión operativa. Estas reglas están en helpers de dominio, no en React.

## Modelo y cambios aditivos

Se conserva `direcciones_creativas` ligada a un `work_items.tipo=direccion_creativa`, con tipos existentes `concepto_portada` y `revision_cubierta`. No se crean roles, enums de work items ni un segundo Command Center. El responsable vigente proviene de `project_assignments` por work item. Solicitudes son intervenciones formales aún sin asignar; al recibirlas se usa el mismo work item y desaparecen de Solicitudes.

Se reutiliza `ficha_diseno_propuestas.direccion_creativa_id` para los conceptos. La migración `0085_fuzzy_inhumans.sql` añade feedback del Brief, feedback RRPP/autor y fecha de revisión del concepto, más `creative_deliveries` (metadata de entregables). No altera datos históricos ni crea contenido de la referencia.

`creative_deliveries` guarda proyecto, proceso, concepto cuando corresponde, tipo BRIEF/CONCEPT_IMAGE/CONCEPT_PDF, URL, ID Drive si el enlace lo contiene, usuario y fecha. Una entrega vigente por proceso/tipo; auditoría conserva los eventos de ajustes. Los campos URL existentes siguen siendo la fuente consumida por Diseño.

## Consulta y proyección del dashboard

`GET /api/direccion-creativa/inicio?orden=accion|fecha` usa la identidad de la sesión. En Fase 2, una CTE SQL compartida reúne procesos/work items/asignaciones/proyecto/coautores/servicio/Especialista, conceptos y últimas versiones de cubierta. Una sentencia por consulta; el coste en sentencias no crece por fila (prueba con 1 y 16 trabajos). Inicio muestra hasta seis acciones; Mi trabajo consulta filtros y páginas de 10/25/50 en el servidor sobre la misma clasificación. No se realizan llamadas Google al leer el Inicio.

| Situación canónica | Acción / estado del Líder |
|---|---|
| Sin Brief entregado | Preparar o continuar Brief. |
| Feedback del Brief | Revisar feedback y entregar Brief ajustado. |
| Brief entregado sin aprobación del autor | Esperando Especialista o autor; fuera de atención. |
| Brief aprobado y conceptos pendientes/borrador | Preparar 2–3 conceptos. |
| Conceptos entregados pendientes RRPP | Esperando RRPP; fuera de atención. |
| RRPP devuelve un concepto | Revisar feedback, entregar ajuste a RRPP. |
| Conceptos aprobados RRPP, sin envío al autor | Esperando Especialista; fuera de atención. |
| Conceptos enviados al autor | Esperando autor; fuera de atención. |
| Feedback del autor | Ajustar ese concepto, devolver al Especialista. |
| Concepto aprobado por autor sin ambos recursos | Entregar imagen y PDF. |
| Ambos recursos entregados | Intervención y work item completados. |
| Diseño entrega versión vigente de cubierta | Verificar cubierta asignada; aprobar o pedir ajustes a Diseño. |
| Proceso cerrado, WI cancelado/completado, gate bloqueante o proyecto culminado/retirado | No genera acción activa. |

Los KPI cuentan acciones reales de Brief (incluye ajustes), conceptos (creación/ajustes) y cubierta. Recursos aparecen en la lista y en Mi trabajo, sin inventar un quinto KPI. El cuarto KPI muestra la próxima fecha no vencida de trabajo accionable; sin fecha usa «Sin fecha pautada».

Solo se usa `work_items.fecha_fin_pautada`. Caracas determina hoy/vencido. Orden central: vencidos, hoy, ajustes, fecha y desempate estable. «Ver todos» en vencimientos abre Mi trabajo por fecha. No hay SLA, prioridad, calendario ni buscador ficticios.

## Actividad y notificaciones

`GET /api/direccion-creativa/inicio/actividad` es independiente del dashboard. Lee los últimos seis eventos creativos de `audit_logs` con asignación vigente a la intervención exacta; para cubierta resuelve la versión/revisión. Excluye pagos y cambios comerciales. Los textos describen eventos persistidos; consultar no genera auditoría. Fallar actividad muestra retry local y mantiene KPI/atención.

Se reutiliza `notificaciones`: asignación, entrega de Brief, feedback de Brief/concepto, checkpoint RRPP, aprobación de autor, ajustes y cubierta. Las entregas de Brief/ajuste de autor/recursos resuelven al Especialista vigente mediante historial canónico. Entregas repetidas idénticas de conceptos, Brief y recursos evitan duplicación en sus caminos idempotentes.

## Operación y rutas

HomePage sigue detectando `lider_creativo`; el contenedor anterior reexporta `CreativeLeaderDashboardPage`. Se usa `CrmSidebarLayout`, logo real, TopBar compartido con cuenta/notificaciones/salida, Card/Estado/iconos existentes y estilos locales. Inicio no duplica TopBar. Sidebar: Inicio, Mi trabajo, Proyectos creativos, Solicitudes y footer «Historias que conectan». No se expone Indicadores porque no hay página analítica real.

Las filas de Mi trabajo abren un diálogo accesible por URL (`trabajo`, `proyecto`, `workItem`, `accion`, `concepto`, `volver`). Conservan IDs y regreso; no envían a Ficha. El servidor vuelve a determinar las acciones permitidas y el formulario usa ese resultado.

- Brief: PATCH `/:id/reunion` y `/:id/brief` existentes. Entregarlo retira la tarea del Líder y avisa al Especialista.
- Conceptos: POST `/:id/conceptos/entregar`, lote estricto 2–3. PATCH `/:id/conceptos/:conceptId` solo si requiere ajuste. RRPP mantiene sus rutas de revisión existentes.
- Autor: rutas `brief-autor` y `propuestas/:propuestaId/autor` existentes, ampliadas con feedback; controles mínimos añadidos en la sección operativa del Especialista.
- Recursos: PATCH `/:id/recursos` existente. Ambos documentos completan el WI y dejan fuentes para el gate de Diseño; un guardado parcial sigue accionable.
- Cubierta: PATCH `/api/diseno/:id/versiones/:versionId/revision-creativa` existente. Solo la versión vigente y el Líder asignado. Rechazo crea feedback para Diseño y cancela la otra revisión de esa versión; aprobación no aprueba la revisión interna.

## RBAC, IDOR y concurrencia

Inicio, actividad y detalle operativo son exclusivos de `lider_creativo`. El detalle exige asignación vigente al proceso exacto. Los comandos de Líder bloquean el proyecto y revalidan asignación, proceso, WI y estado en transacción; impiden robar un proceso ya recibido. Jefatura conserva asignación/reasignación. Cambiar de responsable retira el acceso anterior.

Las consultas generales de proyecto/Ficha requieren alguna intervención creativa asignada. Las escrituras y bandeja legacy de Diseño en Ficha dejaron de admitir al Líder, porque podían alterar conceptos sin vínculo/gates y mezclar producción con Dirección Creativa. Los conceptos se validan contra proceso y proyecto, nunca solo por un UUID enviado. No se aceptan campos de aprobación/owner en el nuevo comando creativo. Especialista usa su asignación canónica para la comunicación al autor. No se amplían permisos de Diseño, RRPP o Jefatura.

## Drive

Se reutiliza el workspace existente y la key canónica `DESIGN`. El detalle lee raíz/carpeta solo cuando el workspace corresponde al contexto vigente y está listo. No introduce carpeta `CREATIVE`, otro OAuth, nueva integración ni llamadas Google al dashboard. Los formularios registran enlaces existentes; no suben binarios ni verifican disponibilidad remota. El ID Drive se extrae solo de hosts `drive.google.com`/`docs.google.com`; un enlace externo conserva URL y tiene ID nulo.

La automatización anterior sigue activándose al asignar Especialista desde Jefatura. En el Especialista se consulta desde Preparación / espacio de trabajo del proyecto. Esta fase creativa consume esos enlaces y no dispara otra raíz Drive.

## Conflictos resueltos y límites

- Código anterior publicaba una propuesta aislada inmediatamente. El nuevo formulario entrega 2–3 en lote. El endpoint secuencial antiguo conserva compatibilidad: la primera es borrador y solo al haber dos se expone a RRPP; máximo tres. Registros históricos no se reescriben.
- Una única propuesta legacy aún sin decisión puede completarse al lote mínimo conservando su ID. Una propuesta histórica ya aprobada por RRPP mantiene su espera del Especialista/autor, sin imponerle una conceptualización nueva retroactiva.
- Código anterior dejaba recursos completos esperando un cierre manual del Especialista. Ahora ambos recursos completan la intervención del Líder; el cierre anterior es idempotente.
- El manual exige aprobación RRPP antes del primer envío al autor, pero no define repetir ese checkpoint en todo ajuste posterior del autor. Se conserva la aprobación RRPP en ese ajuste y se devuelve al Especialista para reenviar; se documenta la decisión en vez de inventar un nuevo gate.
- No hay SLA/prioridad formal confirmada en la matriz; días entre hitos son métricas históricas, no plazos automáticos.
- Inicio no incluye analytics, editor enriquecido del Brief, subida de archivos ni calendario nuevo. Los enlaces entregados no equivalen a una comprobación de acceso en Google.

## Validación y evidencias

Ver [reporte A–AO](../evidencias/lider-creativo/reporte.md), capturas de escritorio/tablet/móvil, estados vacío/cargando/error local y recorridos funcionales. Los ocho proyectos usados en QA están explícitamente marcados `QA`, usan usuarios existentes y enlaces sintéticos `example.test`; no modifican proyectos previos ni llaman a Google. El producto no incorpora datos de ejemplo para rellenar Inicio. Sesiones privadas quedan en `secrets/`, fuera de Git.

## Fase 2 · Mi trabajo (21 de octubre de 2026)

«Mi trabajo» es la bandeja completa de intervenciones asignadas. Inicio mantiene seis acciones prioritarias; Solicitudes mantiene los handoffs aún sin recibir; Proyectos creativos agrupa el contexto por proyecto desde Fase 3. La bandeja no crea trabajos, solicitudes ni asignaciones.

### Fuente y consulta compartida

`server/helpers/creativeInbox.ts` centraliza la clasificación en una CTE SQL (`source → phased → classified`). Inicio, listado y detalle operativo consumen esa misma clasificación. Sustituye la clasificación anterior en JavaScript. El listado hace **una sentencia SQL** para página, total, facetas y contadores. Los joins/laterales consultan proyecto, coautores, servicio, asignación vigente, conceptos y versión vigente de cubierta; no hay consultas de aplicación por fila ni llamadas Google.

`GET /api/direccion-creativa/mi-trabajo` acepta `tipo`, `estado`, `servicio` (UUID del catálogo), `fecha`, `search`, `alcance`, `orden`, `pagina` y `pageSize` (10/25/50). Valida los parámetros y usa exclusivamente el usuario autenticado. La búsqueda literal (incluidos `%`/`_`) cubre título, autor, tarea y feedback; los valores se parametrizan. Filtros, orden, `LIMIT` y `OFFSET` se ejecutan en Postgres; React recibe únicamente la página. Una página fuera de rango se ajusta a la última disponible.

Una fila corresponde a `work_items.id`, ligada a `creativeProcessId` y `projectId`, nunca una fila por proyecto. Se reutilizan `tipo=direccion_creativa` y los business keys existentes para `concepto_portada` y `revision_cubierta`. **No se añadieron roles, tipos persistidos, tablas ni migraciones.** Las seis acciones existentes son BRIEF, BRIEF_ADJUSTMENT, CONCEPTS, CONCEPT_ADJUSTMENT, RESOURCES y COVER_REVIEW. Varios conceptos devueltos del mismo work item se resuelven sucesivamente; cada entrega deja como siguiente acción el primer concepto todavía pendiente. Distintas intervenciones del mismo proyecto conservan sus filas independientes.

### DTO, estados y deadlines

`CreativeWorkItem` entrega IDs de proyecto/proceso/work item/concepto, tipo de acción y grupo de tarea separados, título/contexto, estado, `waitingOn`, `actionable`, fecha pautada real, flags de vencimiento/hoy, proyecto/coautores/servicio, miniatura si es imagen real y fechas persistidas. No incluye prioridad inventada ni URL de navegación suministrada por base de datos. El frontend construye rutas locales desde IDs y tipos conocidos, preservando los filtros en `volver`.

`waitingOn` se deriva del estado canónico: RRPP, AUTHOR, DESIGN o SPECIALIST. Esperas y completadas solo ofrecen «Ver proceso», sin botón primario ni formulario de entrega. La revisión de RRPP sigue precediendo al autor. El Brief entregado espera al Especialista/autor; recursos requieren únicamente imagen/Freepik y concepto PDF. La cubierta usa el comando de revisión creativa por versión existente, separado de Calidad y ejecución de Diseño.

Las fechas proceden de `work_items.fecha_fin_pautada`. Caracas define el día; se reutilizan `diaCaracas` y `clasificarVencimiento`. El orden compartido prioriza vencidas accionables, hoy, ajustes, próximas y sin fecha; las esperas quedan después. Las esperas con fechas pasadas no cuentan como vencidas del Líder. No se introduce SLA ni prioridad formal.

### Facetas y experiencia

Por defecto `alcance=activas` excluye completadas e incluye esperas. Completadas exige selección explícita; `alcance=todas` incluye historial. El contador «Todos» respeta búsqueda/fecha/estado/servicio/alcance y omite únicamente el tipo. Cada faceta omite su propia selección; estados mantienen acceso al historial aunque el alcance predeterminado sea activo. El badge del sidebar representa trabajo **accionable**, mientras «Todos» incluye esperas dentro del alcance. Son poblaciones deliberadamente distintas.

Las categorías superiores contienen solo tipos: Todos, Brief, Conceptos, Recursos y Cubiertas. El panel lateral contiene estados y servicios del catálogo; la barra superior contiene búsqueda con debounce de 300 ms, fecha y orden. Se evitan selectores duplicados y prioridad inexistente. La URL conserva filtros y paginación al entrar/salir del workspace.

La tabla desktop mantiene cinco columnas; a 768 px el panel pasa a diálogo y a 375 px las filas pasan a tarjetas. Hay skeletons por fila, empty real, empty filtrado, error contextual con retry, foco visible, radios semánticos, controles etiquetados y diálogo modal nativo. No hay acciones masivas ni menús ficticios. Se conservan el shell, logo, cuenta y navegación del rol compartidos con Inicio. Indicadores no tiene ruta propia implementada en el proyecto actual; no se añadió un enlace sin destino ni una analítica inventada en esta fase.

### Acceso y validación

Listado exclusivo de `lider_creativo` y asignación vigente al work item exacto. Reasignar retira el acceso anterior; los comandos conservan bloqueo transaccional, validación de concepto/proceso/proyecto y guards existentes. El detalle histórico admite proyectos culminados cuando existe una intervención completada asignada; no habilita escritura sobre ellos. No se amplían privilegios de supervisión, RRPP, Especialista ni Diseño.

Evidencias, recorridos y reporte A–AP: [Mi trabajo](../evidencias/lider-creativo/mi-trabajo/reporte.md). Fixtures explícitos de desarrollo local con usuarios existentes, enlaces `example.test` y prefijo `QA · Mi trabajo`; no contienen secretos ni entran al producto como filas de muestra.

## Fase 3 · Proyectos creativos (21 de octubre de 2026)

«Proyectos creativos» responde en qué estado está cada proyecto del ámbito creativo del Líder. Una fila representa **un proyecto**, aunque tenga varias intervenciones, revisiones de cubierta o work items históricos. «Mi trabajo» conserva una fila por work item; Inicio conserva atención inmediata y Solicitudes conserva handoffs sin recibir. No se añade creación manual ni autoasignación desde el portafolio.

### Modelo y estado del proyecto creativo

`creativePortfolio.ts` consume la misma `creativeSourceSql` y el mismo mapeo de acciones que Inicio/Mi trabajo. No crea otro workflow, procesos, work items, enums, tablas ni porcentajes. Añade una proyección por proyecto sobre las asignaciones vigentes: prioriza la intervención accionable, luego una no cerrada, y desempata con la fecha de creación e ID. Relaciona la cubierta real con su proceso fuente y sus versiones. La identidad pública `creativeProcessId/rootProcessId` permanece en el proceso fuente; `currentWorkItem.creativeProcessId` identifica la intervención concreta que se puede operar.

Estados categóricos de la proyección: MEETING, BRIEF, CONCEPTS, RESOURCES, COVER, COMPLETED y BLOCKED. Reunión procede de `reunion_realizada`; Brief/conceptos/recursos y ajustes proceden de la clasificación común. Los puntos del panel marcan **solo la posición actual**, con texto y `aria-current=step`; nunca etapas cumplidas, ratios ni progreso matemático. El ciclo puede regresar a una categoría anterior.

La entrega de imagen/PDF cierra la intervención conceptual según el dominio existente. Si posteriormente se solicita cubierta a Diseño, el portafolio vuelve a COVER. Diseño sin entregar o con feedback corresponde a waitingOn DESIGN; una entrega pendiente asignada al usuario ofrece la revisión real. Solicitar ajustes completa la revisión puntual del Líder, conserva el proyecto en COVER/DESIGN y permite que el workflow de Diseño genere la revisión de V(n+1). Aprobar la revisión creativa vigente completa el ámbito creativo; no cierra el proyecto editorial ni aprueba Calidad/Edición. Un resultado creativo cerrado sin cubierta conserva su cierre formal persistido. No se fabrica una etapa intermedia ni se reescribe historia.

`waitingOn` usa RRPP, AUTHOR, DESIGN y SPECIALIST; CREATIVE representa una revisión de cubierta asignada a otro Líder, consultable como dependencia sin darle capacidad de operación. `nextStep` siempre describe al responsable actual. Una espera tiene acceso de consulta y carece de CTA primaria del Líder.

El gate de título/subtítulo se respeta también al consultar y operar un proceso ya creado: la clasificación común lo bloquea y `lockCreativeForLeader` reutiliza `evaluarGateTituloAprobado` al escribir. Un registro incompleto sin solicitud formal no se incorpora como proyecto activo. Una solicitud legítima asignada puede aparecer bloqueada, con siguiente paso del Especialista. Esto corrige el dominio compartido sin rediseñar otras pantallas.

### API, filtros y costes

- `GET /api/direccion-creativa/proyectos`: resumen, total y facetas en **una sentencia SQL**, `DISTINCT ON(project_id)`, filtros y `LIMIT/OFFSET` en Postgres. No carga los arrays de conceptos/recursos/timeline en cada fila.
- Parámetros validados: `search`, `service` (UUID catálogo), `creativeState`, `specialist` (UUID), `scope=active|all|completed`, `page`, `pageSize=10|25|50`, `sort=attention|activity|title`.
- `GET /api/direccion-creativa/proyectos/:projectId`: detalle bajo demanda. Una consulta de contexto + una de workspace; añade una lectura de DESIGN únicamente si el workspace está listo y vigente. Coste constante, sin llamadas Google.
- `GET /api/direccion-creativa/proyectos/:projectId/conceptos/:conceptId`: metadata del concepto dentro de ese contexto; valida pertenencia y ofrece acción solo si es el concepto de la tarea accionable vigente.
- `?process=<uuid>` en detalle/concepto valida la relación con proceso fuente/actual; no concede acceso por tener un ID.

El alcance predeterminado incluye activos y esperas; completados exige filtro explícito. «Todos» respeta búsqueda, servicio, Especialista y alcance; omite la categoría seleccionada. Las facetas de categoría conservan acceso al historial; servicio y Especialista omiten su propia selección. La búsqueda literal parametrizada cubre título, coautores y Especialista; escapa `%`, `_` y `\`. React aplica debounce de 300 ms y recibe solo la página pedida. Las páginas fuera de rango se ajustan a la última disponible.

Orden predeterminado: acción del Líder, completados al final, esperas con deadline vigente más próximo y última actividad; los plazos pasados de esperas no se convierten en deuda del Líder. El desempate final es projectId. Orden alternativo por actividad o título.

El Especialista se obtiene de asignación de proyecto vigente, con fallback a FK únicamente cuando no hay historial. Una asignación finalizada no reactiva una FK obsoleta. Se comparte esta resolución con la consulta creativa existente. Servicios/códigos/subtipo Crudo proceden del catálogo y del helper canónico.

### Creative Quick View y seguridad

La selección `selectedProject` vive en URL junto con filtros/página. Desktop usa tabla + panel lateral; tablet usa drawer; móvil usa tarjetas + detalle completo. Seleccionar no ejecuta comandos. Las filas soportan Enter/Espacio y el foco es visible. El panel tiene errores/loading independientes del listado y recupera su inicio al cambiar de selección. `selectedConcept` abre metadata antes del enlace secundario al archivo.

El detalle contiene proyecto/coautores/servicio/Especialista, posición creativa, siguiente paso, deadline del **trabajo actual**, Brief, hasta tres previews y sus estados, recursos del concepto aprobado y hasta seis eventos. El deadline nunca usa la fecha macro del libro: procede del work item creativo/revisión, o del trabajo de Diseño/`due_at` explícito durante una espera de Diseño. Si falta, se indica «Sin fecha pautada».

La actividad y última actividad proceden exclusivamente de `audit_logs`, con catálogo creativo más handoffs de cubierta de Diseño, ámbito por work item/proceso/versión y actor persistido. No se muestran pagos, teléfonos ni payloads de auditoría. No se inventa actividad para metadatos antiguos que no emitieron evento. Los desempates de un mismo timestamp son estables por ID.

Conceptos y previews son registros reales: imagen enlazada si su URL ya apunta a imagen, o placeholder. No se descargan PDFs ni se generan portadas. Los recursos son imagen/Freepik y PDF aprobados. Si hay más de una aprobación histórica, la metadata de entrega existente tiene preferencia al resolver el concepto asociado; no se reasignan documentos por el orden visual de las propuestas.

Drive reutiliza `workspaceSummaries` y la key DESIGN; se presentan URLs persistidas solo para contexto listo/vigente. No se construye una carpeta desde el título, no hay OAuth, explorador Drive ni verificación remota al seleccionar. Sin workspace se muestra «Espacio documental no disponible».

RBAC exclusivo de `lider_creativo` y asignación vigente exacta; un proyecto arbitrario o reasignado devuelve 404/403. Si una revisión propia depende de un proceso fuente de otro Líder, el contexto de cubierta permite solo conceptos aprobados de esa fuente; no expone propuestas no aprobadas ni concede comandos sobre el proceso ajeno. Los formularios siguen revalidando ownership y gates en sus comandos existentes.

Las CTAs se construyen localmente desde IDs/tipo y abren el mismo `CreativeWorkDialog` utilizado por Mi trabajo. `volver` conserva filtros, selección y página. El botón «Ver detalle» selecciona; no lleva a Ficha ni al Project 360 global. No se añadieron permisos de Comercial, RRPP, Jefatura o Diseño.

### Validación

Ver [reporte A–AX](../evidencias/lider-creativo/proyectos-creativos/reporte.md), capturas 1440×900 / 768×1024 / 375×812, metadata de conceptos y ciclo real de cubierta. Diez proyectos nuevos QA usan identidades/catálogos existentes y enlaces sintéticos `example.test`; no modifican proyectos previos ni llaman Google. El ciclo real V1 → ajustes de Diseño → V2 → aprobación conserva la misma fila y raíz creativa, con el libro editorial aún activo. Los scripts QA solo admiten desarrollo local `/panhouse`; sesiones/identidades operativas privadas permanecen en `secrets/`.
