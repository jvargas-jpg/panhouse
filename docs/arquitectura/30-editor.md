# Espacio de trabajo del Editor

Actualizado: 26 de octubre de 2026. Rol técnico existente: `editor`.

## Auditoría de partida

La revisión comenzó con `git status`, `git diff --stat`, `git diff` y los veinte últimos commits. El árbol estaba limpio en `a4f5c8b`. Se revisaron el manual local `fuentes-negocio/Proceso de adiestramiento - Especialista editorial (3).docx`, las auditorías y la arquitectura de Jefatura de Edición, la cola del Editor, capítulos, asignaciones, solicitudes, entregas, SLA, pausas, permisos y workspace Drive.

El Excel no está en esta copia local, pero se localizó y auditó la [Matriz nativa original en Google Drive](https://docs.google.com/spreadsheets/d/1GGGXyIJFJ0rBYVOAAHdTzQA1wh7snQ5UhhAt07NX0N0/edit?usp=drivesdk), en lectura: metadata de sus siete hojas; `EBDD - IA!A1:AW1`, `PAUSADOS!A1:AW1`, `Instructivo EBDD - IA!A1:AV4` y una muestra acotada sin identidad de autores `EBDD - IA!O2:AO6`. Se contrastó con los mapeos de `29-jefe-edicion.md` y el dominio ejecutable. No se descargaron ni importaron autores, proyectos, fechas o porcentajes del archivo a la app.

El instructivo confirma fechas de asignación/inicio/entrega, páginas por fase, capítulos/partes y aplicación de feedback. Fin de edición, GAP y días de ejecución son calculados. La nueva propiedad de campos sigue el prompt: el sistema registra las fechas de acciones y conserva observaciones append-only, en lugar de sobrescribir el comentario anterior como indicaba el instructivo de la hoja manual. C1–C6 no se convierte en un denominador universal ni en un límite de capítulos.

La implementación anterior tenía cuatro páginas sobre el mismo read model, pero heredaba la composición de supervisión; faltaban filtros operativos y detalle consistente. La entrega insertaba el deliverable antes de otra transacción de transición, aceptaba enlaces sin verificar archivo/proyecto y deduplicaba por cinco segundos. La prueba permitía dos entregas. Las solicitudes del Editor no llegaban a la bandeja del Jefe; las aclaraciones podían contaminar la outbox del Especialista. El inicio de capítulos no se exponía en el espacio del Editor. La ruta legacy de capítulos permitía escribir fechas para eludir el comando de entrega.

## Responsabilidades y propiedad de la Matriz

La Matriz es una proyección de los hechos existentes. No se añade una segunda tabla de Matriz ni un workflow de Drive.

| Dato | Propietario / fuente |
|---|---|
| Editor asignado y reasignación | Jefe de Edición; `asignarEditor` y `project_assignments` |
| Fecha de asignación | Sistema; historial de asignaciones |
| Inicio del trabajo | Acción del Editor; capítulos / work item |
| Avance | Nota del Editor; evento append-only en `audit_logs` |
| Archivo y observaciones de entrega | Editor; `editorial_deliveries` |
| Fecha y autor de entrega | Sistema dentro de la transacción |
| Estado, responsabilidad y vencimiento | Proyección `editorialInterventions` |
| Feedback del autor | Especialista; comando de capítulos |
| Feedback aplicado | Entrega del Editor en el mismo ciclo de trabajo |
| SLA y fechas objetivo | `edicionSla.ts`; reglas existentes y pausas persistidas |
| Bloqueo y resolución | Actor autorizado; `editorial_blockers` + auditoría |
| Solicitud y respuesta | `solicitudes_area` + `informacion_solicitud_area` |
| Ubicación documental | IDs y folderKeys persistidos del workspace |

El Editor ejecuta y solicita cambios; no se asigna trabajo, no reasigna directamente ni administra el área. Jefatura conserva la decisión sobre carga y asignaciones. El Especialista coordina material y feedback con el autor.

## Organización del módulo

- `server/routes/editor.routes.ts`: rutas del Editor y decisiones recibidas, separadas del controlador de Jefatura; los prefijos públicos existentes se conservan.
- `server/helpers/editorAccess.ts`: autorización y bloqueo consistente de proyecto antes de work item. Revalida historial vigente y FK dentro de la escritura.
- `editorDashboard.ts`, `editorWork.ts`, `editorialProjects.ts`: proyecciones del dominio compartido. Los filtros, conteos y paginación se resuelven en servidor.
- `editorialDeliveries.ts`: inicio, avance y entrega atómica.
- `editorDrive.ts`: selección/carga documental contextual y validación del archivo.
- `editorOwnRequests.ts`: outbox, revisión, devolución, respuesta y resolución de solicitudes nativas.
- `editorialRequests.ts`: bandeja compartida de Jefatura; incluye apoyo/reasignación del Editor con su semántica correspondiente.
- `frontend/src/editor/EditorUi.tsx`: métricas, estados, búsqueda, filtros, paginación, skeletons, detalle accesible y estado URL.
- `EditorInicio`, `EditorMiTrabajo`, `EditorMisProyectos`, `EditorMisSolicitudes`: cuatro preguntas distintas del mismo producto.
- `EditorRequestDecision`: respuesta reutilizada por Jefatura y Especialista.

Se mantienen el monolito modular, el shell global y el adaptador Google existente. No se incorpora un event bus, una tabla paralela de solicitudes ni otra integración OAuth.

## Las cuatro pantallas

### Inicio

Prioriza trabajo vencido, feedback, bloqueos explícitos y trabajo accionable. Cuatro KPI enlazan a filtros reales. Atención ocupa el bloque principal; próximas entregas sustituye la agenda sin fuente. Feedback muestra actor y fecha reales. La semana ofrece conteos, sin porcentaje universal: completadas cuenta intervenciones distintas con entrega del Editor durante la semana en Caracas; en curso, por vencer y bloqueadas describen la carga actual.

Los accesos rápidos de entrega solo aparecen con una intervención válida. No hay reuniones ficticias, prioridades inventadas ni ranking.

### Mi trabajo

Una fila es una intervención/work item. Un proyecto con varios capítulos conserva varias filas independientes. Hay tabs con conteos del servidor y filtros por búsqueda, estado, tipo, servicio, proyecto y fecha. La selección abre el detalle; abrir no cambia estado.

El detalle presenta trabajo, autoría, Editor, Especialista, asignación, inicio, fecha objetivo y responsabilidad actual. Ofrece material/carpeta vinculados, inicio, nota de avance, entrega, bloqueo y solicitud contextual cuando el estado lo permite. Las entregas y actividad se consultan solo al seleccionar la intervención; móvil no precarga el panel oculto.

No se añade un porcentaje editable, checklist universal, exportación ni tablero sin infraestructura.

### Mis proyectos

Una tarjeta/fila por proyecto con servicio, estado editorial, intervención actual, Especialista, próxima entrega y actividad. Filtros por estado, servicio, Especialista y participación; tarjetas/tabla funcionan y conservan el estado en URL. Los enlaces Drive provienen de metadata persistida y apuntan a Edición.

La participación histórica consulta asignaciones anteriores. Tras reasignar, el Editor conserva su contexto e historial y pierde escritura/acceso documental operativo. Un proyecto sin denominador formal conserva `progress: null`; no se calcula desde el rango contractual. La ejecución vuelve a Mi trabajo.

### Mis solicitudes

Outbox de `requested_by_id = usuario actual`, con búsqueda, tipo y estados. Una solicitud exige contexto de proyecto/intervención y uno de tres tipos existentes: apoyo, reasignación o aclaración. No hay código decorativo inventado ni destinatarios libres.

El detalle muestra motivo, destino, estado, recorrido real, observaciones y resultado con actor/fecha. Una devolución permite completar la pregunta existente y reenviar la misma solicitud. Una resolución es de lectura. La cancelación de una solicitud pendiente/en revisión conserva el historial y usa versión optimista.

## Entrega: una sola transacción de negocio

1. Autorizar intervención antes de cualquier llamada a Google.
2. Verificar estado ejecutable y ausencia de bloqueo/pausa.
3. Consultar metadata real del archivo con el OAuth corporativo existente y verificar su ascendencia contra el workspace persistido.
4. Dentro de una transacción, bloquear proyecto y work item y revalidar asignación y workspace.
5. Si el ciclo ya terminó con el mismo archivo/Editor, devolver el deliverable existente.
6. Insertar deliverable y ejecutar la transición de capítulo/work item en la misma transacción. `actualizarCapituloEditor` acepta una transacción para componer el comando, manteniendo los demás consumidores.
7. Registrar auditoría y notificación al Especialista en esa transacción.

La idempotencia usa el estado del ciclo, no una ventana temporal. El feedback reabre el mismo work item y permite una nueva entrega. Dos llamadas simultáneas producen un deliverable y una auditoría. Un fallo de transición revierte el deliverable; una reasignación durante la consulta a Google rechaza la entrega anterior.

## Drive, folderKeys y versiones

Se reutilizan `GoogleDriveAdapter`, `withCorporateDrive`, OAuth y scope `drive.file`. No se amplían permisos. El adaptador añade selección paginada de archivos de una carpeta concreta y carga de documentos en una carpeta de trabajo autorizada. No hay un explorador de Drive genérico.

La lista de trabajo/proyectos no llama Google. El detalle consume metadata persistida. Solo una acción explícita de selección, carga o entrega llama al proveedor.

- Material EF: `CONTENT_EXTRACTIONS`; otros capítulos: `EDITING_INPUT`.
- Trabajo: `EDITING_OUTPUT`; feedback: `EDITING_FEEDBACK` / `EDITING_FEEDBACK_APPLIED`.
- Intervención no tipificada: `EDITING` persistida, sin inventar rutas de Tripa/Kit.
- Las carpetas, nombres e IDs pertenecen al plan y versión ya persistidos; abrir un proyecto no lo reprovisiona ni cambia su versión.
- Los enlaces aceptados son HTTPS de `drive.google.com` o `docs.google.com`; se exige ID de archivo. Se rechazan carpetas, shortcuts, papelera, orígenes externos y archivos fuera del proyecto. No se expone un proxy para un `fileId` arbitrario.
- Con `drive.file`, un archivo humano externo puede no ser visible para la app. Además de seleccionar archivos accesibles, se puede cargar un documento de hasta 8 MB directamente a la carpeta de trabajo persistida con el mismo adaptador. Su MIME se deriva de la extensión permitida. Esto no entrega ni transiciona trabajo hasta confirmar Registrar entrega.
- Si cambia la asignación durante esa carga, se rechaza la operación y se elimina únicamente el archivo recién creado por ese intento.

Referencias de la API: [permisos Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) y [files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).

## Espera, SLA, feedback y pausas

`assignedEditor` no equivale a responsable actual. `waitingOn=author`, `specialist` o `project_pause` quita accionabilidad y vencimiento del Editor. Una pausa formal conserva su modelo separado. `edicionSla.ts` calcula días hábiles y ajustes por pausa; React solo formatea las fechas recibidas. El umbral de riesgo conserva la regla central existente (exigible hoy), sin inventar tres días para todas las intervenciones.

El feedback del autor se registra desde el Especialista y vuelve la intervención a Requiere ajustes, sin reasignación manual. No se define un SLA nuevo de feedback si el proceso no lo tiene.

## Solicitudes entre roles

`editor_apoyo` y `editor_reasignacion` aparecen en la bandeja real de Solicitudes de Jefatura, con una respuesta distinta de la asignación inicial. Jefatura puede revisar, pedir información o resolver con respuesta. El resultado de reasignación muestra Editor anterior, nuevo Editor y fecha, derivados de project_assignments, sin guardar copias de esos nombres en la solicitud. Una solicitud de reasignación no se resuelve como realizada mientras el solicitante siga asignado: la decisión usa el comando de asignación existente antes de registrar su resultado.

`editor_aclaracion` llega al Especialista actual en Aclaraciones recibidas del Editor, dentro de su pantalla de Solicitudes. El backend revalida ese destinatario; otro Especialista no puede responder. Estas solicitudes no se mezclan con la outbox de solicitudes enviadas por el Especialista.

Las preguntas/respuestas usan `informacion_solicitud_area`; son registros append-only de la conversación operativa, sin crear un chat paralelo.

## Permisos y concurrencia

Cada ruta del Editor exige sesión y `editor`. Las decisiones requieren Jefe o Especialista, según tipo y asignación vigente. Lecturas y escrituras validan IDs y contexto; cambiar `projectId`, `workItemId`, `requestId`, carpeta o archivo no otorga acceso. La URL no concede autorización.

La ruta legacy de capítulos conserva la actualización de páginas, pero rechaza fechas de inicio/entrega del cliente. Esas fechas solo nacen de Iniciar trabajo y Registrar entrega; no existe un atajo HTTP que omita la verificación documental.

Las escrituras críticas bloquean proyecto antes de work item, el mismo orden de asignación. Solicitudes usan versión optimista y rechazan duplicados abiertos. Un Editor anterior no entrega después de una reasignación, incluso si la página permanecía abierta.

## Auditoría, notificaciones y caché

Inicio, avance, carga documental, entrega, bloqueo y solicitudes producen hechos de negocio. Abrir un panel no se audita como ejecución. La migración `0089_editor_notification_context.sql` añade `notificaciones.target_path`; los eventos nuevos pueden abrir el contexto exacto. Se conservan los destinos anteriores como fallback.

Las mutaciones invalidan las proyecciones del Editor, Jefatura, notificaciones y las consultas relacionadas. No se usa `window.location.reload()`. Varias modificaciones de filtros/selección se actualizan juntas para evitar que React Router restaure un parámetro anterior al cerrar el detalle.

## Sistema visual y accesibilidad

Sidebar azul marino, acento dorado, fondo claro, títulos serif, tarjetas compactas, estados semánticos con texto y placeholder editorial neutral. El footer Historias que conectan es branding estático. TopBar es el componente global, con nombre/rol y menú de cuenta.

En escritorio, trabajo y solicitudes muestran tabla y detalle lateral. En tablet el detalle es un drawer y los KPI son 2×2. En móvil, filas como tarjetas y detalle de pantalla completa. El panel soporta Escape, foco inicial, ciclo de Tab en móvil y restitución de foco. Loading/error/empty se presentan localmente, con reintento contextual.

## Verificación y límites de la evidencia

La evidencia está en `docs/evidencias/editor/`, con doce capturas 1440×900, 768×1024 y 375×812, más detalle móvil y reportes JSON. Los scripts QA trabajan en `panhouse_editor_preview_20261026`, sin modificar proyectos de desarrollo.

Las pruebas de integración usan PostgreSQL y comandos reales; solo se sustituye la frontera Google. Cubren autorización, idempotencia estricta, rollback, reasignación durante validación/carga, archivos externos, plantillas antiguas, solicitudes entre roles, múltiples intervenciones y ausencia de llamadas Drive desde listas.

La base local revisada no tiene una integración Google Drive registrada ni workspaces documentales. Por eso no se afirma una entrega real contra Google: la prueba viva de OAuth/archivo necesita conectar la cuenta. El acceso al archivo de referencia mediante el conector de Codex no crea una conexión OAuth dentro de PanHouse. Tampoco se afirma inspección visual de una portada real si el proyecto no la proporciona. No se copiaron autores, portadas, números ni fechas de las imágenes.
