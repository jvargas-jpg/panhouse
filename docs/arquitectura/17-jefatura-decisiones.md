# Jefatura · Decisiones y escalaciones

## Alcance y estado heredado

Base: `99090c1`, con Seguimiento operativo sin confirmar y el trabajo de Claude recibido durante la revisión. Se conservaron su entidad `decisiones`, migración 0076, dos orígenes nativos, rutas, bandeja/expediente y 14 pruebas. La revisión se apoyó en código, pruebas y navegador; las afirmaciones del documento anterior no se tomaron como verificación.

Claude había implementado creación desde Corrección y escalación explícita desde Calidad, lectura, inicio de revisión, pregunta/respuesta por API y resolución del gate. Faltaban la respuesta del solicitante en UI, enlaces contextuales, notificaciones navegables y la integración efectiva de Inicio. Su expediente no protegía escrituras simultáneas mediante bloqueo; la versión era opcional. Un aviso de Soporte se enviaba al rol Especialista. La autorización de lectura no permitía al solicitante leer su propia pregunta. La revisión se aplicaba indebidamente a preliminares de más de 120 páginas.

| Hallazgo | Corrección verificada |
| --- | --- |
| Lectura previa sin bloqueo, posible doble resolución | `FOR UPDATE`, versión y transacción para estado, gate, evento y avisos. |
| Dos solicitudes concurrentes podían crear fuentes diferentes | Bloqueo del proyecto y cálculo de business key dentro de la transacción. |
| Aviso al rol equivocado | Rol del solicitante real; destinatario individual y `decisionId`. |
| Solicitante sin pantalla para contestar | Ruta contextual autenticada y control por `requestedByUserId`. |
| Respuesta desaparecía al volver a revisión | Pregunta/respuesta visibles también en revisión y resolución. |
| Decisión resuelta mientras se esperaba información | 409; esperar respuesta antes de resolver. |
| Pregunta repetida duplicaba avisos | 409 sin nuevo evento ni notificación. |
| Lecturas sin scope del destino/proyecto retirado | Filtro por rol destino y proyecto no retirado; lectura propia del solicitante. |
| Origen/filtros y contexto incompletos | Tipo, origen, fechas, motivo, autor fallback y Especialista canónico. |
| Caso desaparecía del filtro al abrirlo | Caso seleccionado fijado con indicación «fuera de este filtro». |
| Error de confirmación oculto y foco libre | Error dentro del modal; foco, Escape y controles deshabilitados durante envío. |
| Actividad fallida parecía vacía | Error independiente con Reintentar. |

## Fuentes de negocio y límites

`fuentes-negocio/` y el Manual original no están disponibles en este checkout. El Excel de Seguimiento fue inspeccionado en lectura por la tarea anterior; su tabulador histórico no se convirtió en una norma nueva. Se reutiliza la condición ya implementada de GATE-06: **Tripa Word completa estrictamente mayor que 120 páginas**. 120 no genera el gate, 121 sí; preliminares/cubierta no lo generan por su número de páginas.

La supuesta consulta obligatoria a Jefatura para elegir corrector de portada no tiene fuente documental disponible que resuelva la contradicción con la asignación normal existente. Queda **PENDIENTE_VALIDACION_DOCUMENTAL_PORTADA_JEFATURA**. No se añadió ese tipo de decisión.

No se trasladan decisiones de Editor, RRPP, Dirección Creativa, Amazon, Talento o Lanzamiento a Jefatura. Tampoco se convierten notificaciones o eventos de auditoría en casos pendientes. No hay formulario para crear decisiones libres, chat, solicitud genérica, SLA de respuesta o urgencia inventada.

## Modelo final

`work_items` continúa representando procesos; `decisiones` representa su caso humano. La entidad especializada conserva `proyectoId`, `originWorkItemId`, un origen nativo único (`originCorreccionId` o `originCalidadFaseId`), solicitante, rol destino, subject, mensajes, snapshot mínimo, fechas, resolutor y versión. El origen nativo identifica su intervención/ronda y business key; no se crea otro work item ni otro gate para decidir.

`status`: pendiente → en_revision → resuelta, con informacion_solicitada → en_revision. `resolutionType`: approved/rejected/cancelled, separado del lifecycle. La UI muestra Aprobada/Rechazada según el resultado. Abrir un caso pendiente inicia su revisión una vez; los resueltos son de lectura.

El snapshot guarda solo páginas o colección/motivo del origen. Autor, título, servicio, Especialista vigente y condición del gate se consultan en vivo. No se copian datos canónicos del proyecto.

La migración 0076 heredada se conservó intacta. Las migraciones **0077 y 0078 son aditivas**: enlace nullable de notificaciones a decisión, controles de origen/estado/versión/resolución e índices de bandeja, proyecto y work item. No se modificaron migraciones aplicadas. La bandeja usa dos consultas SQL — conteo/lista — para 10 o 31 casos; orden estable por fecha e ID, filtros antes de paginar. El campo heredado API `urgentes` se utiliza para contar gates de Corrección abiertos y se rotula «Bloquean Corrección»; no representa una prioridad comercial.

## Flujos y transacciones

**Corrección >120.** La solicitud normal del Especialista crea corrección, work item, decisión, evento y aviso en la misma transacción. Reintentos devuelven la fuente existente. Asignar Corrector sigue comprobando GATE-06. El cliente ya no puede escribir `revisionPreviaConfirmada`; el schema de asignación rechaza campos desconocidos. Aprobar en Jefatura actualiza ese campo y resuelve el caso atómicamente. El Especialista conserva la asignación del Corrector y el Corrector conserva su trabajo operativo. Rechazar exige motivo y mantiene el gate bloqueado.

**Información.** Jefatura formula una pregunta en el caso existente; se notifica al solicitante real con enlace `/decisiones/:id/responder`. Solo esa persona puede leer su contexto como solicitante y contestar. La respuesta incrementa versión, vuelve a revisión y avisa a Jefatura. Esperando información no ofrece aprobación/rechazo. No se crean casos nuevos para cada mensaje.

**Colección.** Soporte Editorial declara una discrepancia con motivo en una fase F1/F3 vigente y no revisada. No se dispara automáticamente porque falle un criterio de logo. El caso conserva la fase real; duplicar la acción no duplica caso/avisos. Jefatura puede pedir información, descartar con motivo o acordar revisar con RRPP. En este último caso RRPP recibe aviso para verificar el dato. No se cambia la colección, el checklist, la aprobación ni el owner de Calidad; esta escalación no es un bloqueo nuevo del proceso.

**Concurrencia.** La escritura bloquea la decisión; aprobación bloquea también su corrección. Una versión antigua devuelve 409, un caso resuelto rechaza posteriores resoluciones y un fallo de auditoría revierte decisión y gate. La UI bloquea doble envío y refresca el caso tras conflicto. Las pruebas incluyen `Promise.all` de creación y de resoluciones opuestas, y fallo intencional de auditoría dentro de la transacción.

## Permisos e integraciones

Listado, resumen e intervenciones de Jefatura exigen `jefe_area`. Detalle/actividad admiten el rol destino o al solicitante real, excluyendo proyectos retirados. Otro usuario del mismo rol solicitante no obtiene el expediente. El ámbito de Jefatura es su rol en el modelo vigente; no existe segmentación adicional confirmada por unidad. Resolución verifica rol destino también dentro de la transacción. Responder verifica identidad, estado y versión. UUID inexistente/fuera de ámbito produce 404 en lectura.

- **Inicio:** KPI y cola nativa comparten `decisiones`; «Asignaciones creativas» conserva las solicitudes de elegir responsable, que tienen otro propósito.
- **Seguimiento:** identifica el caso por origen; muestra «Bloqueado por decisión» para Corrección y enlace «Ver decisión». Calidad muestra su escalación sin fingir bloqueo. No se resuelve desde Seguimiento.
- **Proyectos/Quick View:** proceso nativo con `decisionId` y CTA contextual. La sección de Corrección muestra el gate y enlace a su caso.
- **Ficha:** eventos humanos de creación, revisión, información y resolución; resultado aprobado/rechazado distinguible.
- **Notificaciones:** `decisionId`, destinatario real y rol correcto. Jefatura abre el expediente; solicitante abre su respuesta contextual. Avisos ordinarios mantienen el destino del proyecto.
- **Caché:** acciones invalidan decisiones, Jefatura, Seguimiento, notificaciones y Corrección.
- **Auditoría:** eventos reales con actor, fecha, proyecto, entidad y mensaje/resultado; audit no actúa como bandeja.

## Revisión visual y funcional

Se capturó la UI real, con datos ficticios solo en una base aislada. Primera captura: filas de 122 px, cabecera global duplicada, panel tablet debajo de la bandeja y caso seleccionado perdido tras cambiar a revisión. Segunda captura: filas de **100 px**, título 28 px, sidebar 224 px, bandeja **467 px** y expediente **685 px** (40,6%/59,4%) a 1440×900; ambos terminan a **876 px**, dentro del viewport. Contexto y consecuencias planos; pregunta destacada en dorado; acciones fijas. Sin gradientes, glass, violeta o cuadrícula de tarjetas equivalente a Seguimiento.

768×1024: expediente lateral de 580 px, cierre, foco y scroll propio. 375×812: expediente de 375 px, acciones visibles, modal con foco/Escape y bandeja con primer caso visible. Capturas iniciales/finales y estados en `docs/evidencias/decisiones-jefatura/`. La comparación con Seguimiento usa la misma aplicación real.

El recorrido Playwright **qa-functional.json** completó **12 comprobaciones y cero errores de página**: Inicio, Seguimiento, gate/approval/asignación, audit/avisos, pregunta/respuesta real, rechazo obligatorio, conflicto, aprobación móvil, vacío/filtros URL, colección/Soporte/RRPP y caso resuelto de lectura. El frontend no tiene runner unitario configurado; esta evidencia corresponde a navegación y acciones reales, no a unit tests inventados.

**qa-links.json** añade **6 comprobaciones y cero errores**: Quick View → expediente, panel tablet medido a 580 px, mobile/acciones a 375×812, aviso al solicitante → respuesta, aviso a Jefatura → expediente y aprobación visible en el historial real de Ficha. Seguimiento conserva sus 13 recorridos funcionales y 23 comprobaciones de geometría del segundo ciclo. La revisión de desarrollo final fue de lectura y mostró el vacío real después de retirar fixtures.

## Validación y limpieza

Baseline independiente: **2 archivos, 42 tests, 42 passed, 0 failed** (14 heredados de Decisiones + 28 de Seguimiento). La revisión específica inicial tuvo 7 archivos/156 tests, 154 passed y dos errores en nuevas fixtures: el reintento concurrente correctamente devolvía 200 frente al 201 esperado; 31 work items compartían la clave por defecto. Se corrigieron las expectativas y las business keys.

La primera suite de Seguimiento compartió una base con otro proceso de Vitest y arrojó 18 fallos; no se presentó como verde ni se atribuyeron a defectos preexistentes sin evidencia. La validación final usa una base exclusiva y un PostgreSQL temporal en memoria; los ajustes fsync/synchronous_commit solo pertenecen al contenedor QA. No se cambiaron los del desarrollo.

La regresión completa se divide con `--shard=1/3`, `2/3`, `3/3`; cada grupo tiene su propia base y conserva ejecución serial por archivo. Los timeouts de test/hook se amplían a 180 segundos solo en el runner QA después de observar un hook de preparación de Diseño exceder 30 segundos bajo carga; no se omiten tests ni se cambian assertions para cubrirlo. El reporte consolidado comprueba que no se repitan archivos y suma los tres resultados.

**Resultado final:** 59 archivos y 1.117 tests, 1.117 passed, 0 failed, 0 skipped. Los tres grupos terminaron con exit 0; se comparó la unión con los 59 archivos reales, sin omisiones ni duplicados. Backend: typecheck y build exit 0. Frontend: typecheck y build exit 0; aviso no bloqueante de chunk principal de 864,30 kB. El subconjunto de siete archivos/156 tests, incluidos 23 de Decisiones y 28 de Seguimiento, pasó completo dentro de esta regresión; su JSON declara expresamente que es derivado, no otra invocación. Evidencia: tests-completos.json, tests-shard-1/2/3.json, tests-especificos.json y validacion.json.

Las fixtures de navegador no se añadieron a seeds productivos. Se identificaron cuatro correcciones de prueba de Claude en proyectos existentes (incluido Corrector QA Freelance y preliminares de 999 páginas); su limpieza se limita a esos IDs y sus dependencias, preservando proyectos y usuarios. Se retiraron las tres bases propias de QA en 5433 (Seguimiento, Decisiones y baseline), los servidores 3005/5176 y el contenedor RAM de regresión con sus bases por grupo; se verificó su ausencia. Los servidores de desarrollo 3000/5173 continúan activos. La limpieza retiró 4 correcciones, 4 decisiones, 4 work items y 14 eventos exclusivamente artificiales; conservó los 30 proyectos existentes y los usuarios.

## Informe A–AD

| Punto | Resultado |
| --- | --- |
| A | Entidad, migración 0076, workflow inicial y 14 tests de Claude preservados. |
| B | Schema/helper/routes/shared/tests de Decisiones; integraciones Corrección/Calidad/Jefatura; frontend bandeja, sidebar y panel; documento heredado revisado. |
| C | Dos orígenes reales, lifecycle, API, gate transaccional básico y bandeja/expediente. |
| D | UI de respuesta, enlaces, Inicio efectivo, scope de lectura, bloqueo concurrente y QA completa. |
| E | Doble creación/resolución potencial, rol incorrecto del aviso, preliminares con gate, pregunta repetida y respuesta oculta. |
| F | Filas 122 px, tablet fuera de pantalla, cabecera duplicada, errores/foco de modal y selección perdida. |
| G | UNIQUE sin serialización, integridad conceptual, destino sin scope y notificación sin referencia al caso. |
| H | Bloqueos/validaciones, índices, permisos, UI contextual, integraciones, filtros URL y revisión visual. |
| I | Caso especializado ligado a fuente nativa; lifecycle y outcome separados; snapshot mínimo. |
| J | Reutiliza work item e intervención/ronda; aprobación satisface GATE-06 existente. |
| K | 146 páginas bloquea asignación; aprobación UI habilita asignación nativa y registra un evento. |
| L | Pregunta → aviso al solicitante → UI de respuesta → mismo caso en revisión. |
| M | Aprobación atómica; rechazo con motivo obligatorio mantiene bloqueo. |
| N | Creación/resolución simultáneas, CAS, cierre inmutable, doble click y rollback probados. |
| O | 401/403, destino, identidad del solicitante, retirados y lecturas 404 cubiertos. |
| P | KPI/cola de Inicio con la misma fuente y enlaces. |
| Q | Bloqueo/enlace contextual; supervisión no resuelve gates. |
| R | Quick View, sección Corrección, escalación Calidad y eventos humanos en Ficha. |
| S | Avisos con decisionId y destinatario/rol verdaderos. |
| T | Actor/fecha/origen/mensaje/resultado, transacción y actividad legible. |
| U | 156/156 del subconjunto de 7 archivos dentro de la regresión; incluye 23 Decisiones y 28 Seguimiento. |
| V | 59 archivos; 1.117 tests; 1.117 passed; 0 failed; 0 skipped. |
| W | Backend typecheck/build exit 0. |
| X | Frontend typecheck/build exit 0; 18 checks de navegador en Decisiones; aviso de chunk 864,30 kB. Sin runner unitario configurado. |
| Y | desktop-1 → defectos citados → desktop-2 con filas 100 px, 40/60 y footer visible. |
| Z | tablet-1 → tablet-2 con panel lateral, foco y cierre. |
| AA | mobile-detail/inbox-1 → ciclo 2; aprobación/foco/Escape reales. |
| AB | Manual/portada pendiente de fuente; sin SLA de respuesta, prioridades inventadas, reapertura ni importación histórica. |
| AC | Cierre con todos los cambios autorizados revisados y confirmados localmente; sin fixtures/secrets productivos. Estado verificado tras el commit. |
| AD | Commit local `feat: finalize jefatura decision workflow`, integra Seguimiento y su workflow de decisiones. Implementación `d831242`; evidencia en commit local separado. Sin push. |

## Reproducción de QA

El runner de regresión requiere PostgreSQL local temporal en 5434 con las credenciales de desarrollo y crea exclusivamente bases `panhouse_codex_decisiones_1/2/3_test`; el contenedor de esta ejecución fue eliminado. Los scripts de navegador requieren Playwright/Chromium instalado en `%TEMP%/panhouse-browser-qa`, estados de sesión temporales y las fixtures aisladas generadas por los scripts. Seguimiento parte del snapshot local preexistente `panhouse_portafolio_qa`; no se incluye ni importa ese snapshot como datos del producto. Estas dependencias se declaran para no presentar los scripts como una suite frontend unitaria o una reproducción sin preparación.
