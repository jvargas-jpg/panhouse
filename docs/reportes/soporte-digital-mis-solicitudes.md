# Soporte Digital · Mis solicitudes

28 de octubre de 2026. Alcance: solicitudes salientes del usuario digital. No se rediseñaron Inicio, Mi trabajo ni pantallas de otros roles. Se habilitó la navegación del rol y se extendió el sistema canónico de solicitudes.

La revisión visual no está terminada: el navegador conectado no está disponible y Computer Use detuvo la inspección porque no pudo verificar la URL actual de Chrome. No se generaron capturas nuevas ni se presenta el diseño como visualmente aprobado. Las pruebas de React descritas abajo verifican renderizado y estados, no sustituyen QA en navegador.

| Punto | Resultado |
| --- | --- |
| A. Estado previo | Mis solicitudes era un elemento no interactivo del menú digital. No había ruta de pantalla ni servicios de solicitudes salientes digitales. Se preservaron los cambios previos de Mi trabajo y el script de reset de contraseña, sin ejecutarlo. |
| B. Rutas/componentes | Interfaz `/?vista=mis-solicitudes`, selección `request=<id>`, panel `detailTab=detail/files/history`, creación `create=1&workItemId=<id>`. `SoporteDigitalMisSolicitudes.tsx`, `soporteDigitalRequestsApi.ts`, CSS propio, `soporteDigitalRequests.routes.ts` y helper del mismo nombre. |
| C. Schema | Se reutilizan `solicitudes_area`, `informacion_solicitud_area`, `audit_logs`, `notificaciones` y `editorial_blockers`. Se agrega `solicitudes_area.blocker_id` y la tabla dependiente `solicitud_archivos` para evidencia. No hay un sistema paralelo de tickets digitales. Migración aditiva `0093_digital_requests.sql`, aplicada a desarrollo y a tests. |
| D. Unión de tipos | Se conservan `lanzamiento`, `impresion`, `creativa`, `editor`, `editor_apoyo`, `editor_reasignacion`, `editor_aclaracion`, `corrector_material`, `corrector_aclaracion`, `corrector_tecnico`, `calidad_material`, `calidad_aclaracion`, `calidad_tecnico`. Se agregan únicamente los tres tipos digitales siguientes. |
| E. Lifecycle real | `pendiente`, `en_revision`, `requiere_informacion`, `resuelta`, `rechazada`, `cancelada`. Apertura no cambia estado. Revisión, devolución y resolución son comandos explícitos del destinatario. No se inventan Abierta/Cerrada ni estados Amazon. |
| F. Tipos digitales | `digital_material`: material incorrecto o faltante; `digital_aclaracion`: aclaración operativa; `digital_tecnico`: problema técnico o de acceso. Siguen las convenciones ya existentes en Corrector y Calidad y las necesidades del trabajo digital real. |
| G. Tipos descartados | No se reutilizan `editor` ni tipos de otros handoffs. Sin Duda KDP, prioridad Alta/Media/Baja, categoría de bloqueo duplicada o taxonomía basada en los ejemplos de la imagen. |
| H. Destino | Especialista coordinador vigente del proyecto, activo y con rol correcto. El backend lo determina desde las asignaciones canónicas, con el fallback legacy existente. El cliente no puede enviar target, responsable, estado, proyecto ni prioridad arbitrarios. |
| I. Proyecto | Derivado del work item. El trigger de contexto impide relacionar solicitud y trabajo de proyectos diferentes. El proyecto no se toma de un campo libre del frontend. |
| J. Work item | Obligatorio y de tipo `soporte_digital`. No se permite crear sobre tareas canceladas ni procesos digitales cerrados. La excepción real de `activacion_amazon` completada conserva la posibilidad de operar sobre el trabajo digital posterior mientras no se cierre el control. |
| K. Assignment | La asignación individual digital se retiró del dominio: las tareas son compartidas por rol. No se inventa assignmentId digital. La coordinación del Especialista sí utiliza su asignación vigente y se revalida al decidir. |
| L. Blocker | Relación opcional explícita mediante `blocker_id` con `editorial_blockers`, cuya FK ya identifica work items. Se crea solo si el solicitante marca que no puede continuar. No se infiere por tipo ni se duplica un gate ya existente. |
| M. Row DTO | `DigitalRequestRow`: identidad de solicitud, tipo/tema/resumen, proyecto/autores/portada/código, tarea y etapa al enviar, estado/versión, creación/actividad, acción requerida, bloqueo vinculado y permisos. Una fila representa una solicitud. |
| N. Detail DTO | Descripción original, destinatario/coordinación actual, bloqueo real, preguntas y respuestas estructuradas, adjuntos, historial y resultado con actor/fecha/referencias. Carga por solicitud seleccionada. No devuelve binarios en la lista ni en el detalle. |
| O. Tabs | Todas, Pendientes, Requieren tu acción, Resueltas y Canceladas. Pendientes agrupa pendiente/en revisión; requiere acción deriva de requiere información. Rechazada sigue disponible como estado canónico filtrable en Todas, sin simular resolución satisfactoria. |
| P. Counts | Agregación SQL de todas las solicitudes propias que cumplen los filtros, antes de aplicar tab/página. No son counts de la página visible. |
| Q. Search | Debounce de 300 ms. Búsqueda literal en servidor por título, código, autor, tipo/etiqueta, tema, descripción y tarea registrada al enviar. `%` y `_` no actúan como comodines. |
| R. Filters | Estado, tipo, proyecto y rango de creación. Fechas evaluadas en America/Caracas, rango validado. No se añadió filtro de prioridad ni un selector global de destinatarios. |
| S. Pagination | PostgreSQL `LIMIT/OFFSET`, tamaños 10/25/50 y ajuste a páginas válidas. El selector de contexto también pagina sus tareas elegibles. |
| T. Sorting | Primero información pendiente del solicitante; luego solicitudes abiertas con bloqueo vinculado; después pendientes ordinarias, resueltas e históricas/canceladas. Empates por actividad significativa e id. |
| U. Selected row | Se selecciona requestId sin navegar ni mutar. URL conserva selección, tab, búsqueda, filtros y página. Teclado Enter/Espacio, focus visible y cierre del panel. |
| V. Detalle | Texto original, tipo, tema, estado, etapa al enviar, tarea relacionada, destinatario, coordinación actual, creación y último evento. Sin persona falsa asignada, prioridad inventada o botones del resolver. |
| W. Files | Evidencia propia de la solicitud con nombre, MIME, tamaño, fecha, actor y enlace autorizado. No se muestra Drive ni se mezclan entregables de publicación con evidencia. |
| X. Comments | No existe un modelo canónico de comentarios de solicitudes. No se creó chat ni pestaña Conversación. Se reutiliza `informacion_solicitud_area` para preguntas/respuestas, con actores y fechas, y sin sobrescribir respuestas ya enviadas. |
| Y. History | Eventos de envío, revisión, información solicitada/completada, evidencia añadida, resolución, cancelación y desbloqueo explícito. Sin eventos de visitas, filtros o tabs. |
| Z. Create | Modal con tipo permitido, tarea elegible, tema, descripción, destino de solo lectura, bloqueo opcional y evidencia opcional. Proyecto/tarea/etapa/solicitante/destino quedan vinculados. Si la evidencia posterior falla, la solicitud enviada se conserva y se informa cómo reintentar. |
| AA. Update/complete info | No se ofrece edición arbitraria del registro. Solo puede completarse una pregunta real pendiente, con ownership y versión actuales; se conserva la pregunta, se agrega su respuesta y vuelve a pendiente. |
| AB. Cancel | Confirmación local, actualización a cancelada, actor/fecha/motivo/audit. Nunca DELETE. No se permite cancelar un bloqueo vinculado activo sin intervención del Especialista, para evitar dejar la tarea detenida sin seguimiento. |
| AC. Resolution | Solo el Especialista coordinador actual puede revisar, pedir información o resolver mediante el servicio del destinatario. El solicitante no puede resolver ni siquiera si posteriormente cambia de rol. Resultado y entidad se conservan. La UI del receptor no se añadió a otras pantallas por la restricción de alcance. |
| AD. Result references | Referencia opcional a otro work item digital del mismo proyecto y/o a evidencia de la misma solicitud, validada en servidor. Actor, fecha y resolución reales. No se declara que se reemplazó un archivo si no hay relación que lo respalde. |
| AE. Attachments | PNG, JPEG o PDF de hasta 5 MiB, con validación de nombre, base64, firma de formato y tamaño. Binario privado y metadatos en `solicitud_archivos`, ligado al sistema canónico; hash SHA-256 y uploadKey para reintentos. Adición solo en pendiente/requiere información y tarea accesible. |
| AF. File authorization | El archivo se obtiene por requestId + attachmentId, verificando proyecto/work item y solicitante o Especialista vigente. Otro requestId no permite abrir el archivo. No se acepta driveFileId ni URL arbitraria. La evidencia interna no usa workspace de Drive; su autorización depende de la entidad propietaria, y no se crean carpetas ni permisos externos. Respuesta con MIME real, nosniff, sandbox y cache privada/no-store. |
| AG. Blocker integration | Crear con bloqueo actualiza la tarea y guarda su estado anterior en audit dentro de la misma transacción. Resolver la solicitud no desbloquea por defecto. El Especialista puede resolver el bloqueo explícitamente al resolver, o después con `unblock`; se verifica que siga siendo ese mismo bloqueo y se restaura el estado anterior. Un gate cambiado no puede borrarse. |
| AH. Deep link Mi trabajo | «Ver tarea relacionada» enlaza `/?vista=mi-trabajo&workItem=<id>`. La creación contextual acepta `/?vista=mis-solicitudes&create=1&workItemId=<id>` y reutiliza el mismo servicio. No se añadió un botón a Mi trabajo en esta iteración. |
| AI. Notifications links | Avisos al solicitante abren Mis solicitudes con requestId seleccionado. Avisos al Especialista llevan al proyecto; la API separada de solicitudes recibidas permite operar la misma entidad. Integrar una nueva bandeja visual en Especialista queda fuera de esta pantalla. |
| AJ. Duplicate prevention | Índice único parcial y validación de una solicitud abierta por requester + workItem + tipo. Un segundo usuario digital puede tener su propia solicitud sobre la misma tarea compartida, sin ver el outbox del primero. |
| AK. Idempotency | Clave UUID de envío por requester; un reintento idéntico devuelve el mismo id, un payload diferente con la misma clave devuelve conflicto. Evidencia deduplicada por request/uploadKey y hash del contenido. Submit protegido también con ref síncrona en frontend. |
| AL. Concurrency | Lock de proyecto, work item y solicitud; versión entera del lifecycle. Se revalidan estado actual, coordinación, pregunta y permiso para adjuntar. Mutación stale devuelve 409; interfaz invalida cache y muestra el conflicto. |
| AM. Notifications | Creación/complemento/cancelación avisan al Especialista; revisión/devolución/resolución/desbloqueo avisan al solicitante. Reintentos idempotentes no duplican avisos ni eventos. No se confunden notificaciones con solicitudes. |
| AN. Audit | Todos los comandos de negocio guardan actor, entidad, proyecto y referencias dentro de su transacción. La creación guarda contexto y estado previo de trabajo, los archivos guardan attachmentId, la resolución guarda sus referencias. |
| AO. RBAC | Middleware de sesión/rol y revalidación del usuario activo en comandos. Solo soporte_digital usa el outbox y sus escrituras; solo Especialista vigente decide. Caché segmentada por usuario: el placeholder de paginación conserva datos únicamente dentro de la misma sesión de usuario. Sin asignación de responsables o cambio de status arbitrario desde el cliente. |
| AP. IDOR | Tests de solicitud ajena, mutación ajena, work item de otra área, proyecto inconsistente, destinatario anterior/no autorizado, attachment cruzado, resultado de otro proyecto y referencia ajena. Se respeta la bandeja digital compartida sin inventar propiedad individual de tareas. |
| AQ. Performance | Una consulta SQL para listado con totales/opciones; una para contextos; detalle con consultas paralelas acotadas para preguntas, historia y metadatos. Los binarios se leen solo al abrir un archivo. Sin llamadas a Amazon/Google por fila. |
| AR. N+1 | Joins/agregación de autores y contexto; auditoría por entidad con índices y joins SQL, sin bucles de consultas desde Node ni cargas de archivos por fila. No se realizó benchmark de producción. |
| AS. Tests | Regresión aprobada: 180 pruebas en 12 suites. Incluye 23 nuevas de backend y 14 nuevas de interfaz, más Inicio/Mi trabajo digital, solicitudes de Editor/Corrector/Calidad, lifecycle compartido, work items y notificaciones. Las pruebas de interfaz son de renderizado SSR, no de interacción visual en navegador. |
| AT. Resultados | Preparación previa al paquete, continuidad después de activación, cierre digital, devolución/complemento, cancelación conservando evidencia, resolución con/sin desbloqueo y reintentos fueron comprobados por API en la base aislada. No se insertaron proyectos demo en desarrollo. |
| AU. Typecheck | Backend y frontend aprobados, sin errores de TypeScript. |
| AV. Builds | Backend y frontend aprobados. Vite advierte sobre el tamaño del bundle principal; no impide generar producción. |
| AW. QA 1440 | Pendiente: Computer Use no pudo determinar con suficiente confianza la URL de Chrome; se detuvo la inspección. No hay captura nueva 1440×900. |
| AX. QA 768 | Pendiente por el mismo bloqueo. CSS utiliza lista completa y drawer, con filtros colapsables. No se declara verificación visual 768×1024. |
| AY. QA 375 | Pendiente por el mismo bloqueo. CSS adapta la tabla a tarjetas y el detalle a pantalla completa, con acciones en footer. No se declara verificación visual 375×812. |
| AZ. Correcciones QA | Se implementó jerarquía editorial, logo oficial, shell navy/dorado, master-detail, densidad y responsive basados en los patrones existentes. No se atribuyen a una comparación de capturas que no pudo realizarse. |
| BA. Archivos tocados | Ver inventario final. Solo navegación compartida, pantalla nueva, servicios/esquema de solicitudes, migración y pruebas relacionadas. |
| BB. git diff --stat | Ver inventario final. El diff total incluye cambios previos de Mi trabajo que se conservaron. Los archivos nuevos no aparecen en `git diff --stat` mientras sigan sin seguimiento. |
| BC. git status | Ver inventario final. Sin commit, sin stage y sin modificar `.env`, Docker Compose o contraseñas. |

## API

Prefijo `/api/soporte-digital`:

- `GET/POST /mis-solicitudes`, `GET /mis-solicitudes/contextos`, `GET /mis-solicitudes/:id`.
- `POST /mis-solicitudes/:id/completar`, `/cancelar`, `/archivos`.
- `GET /solicitudes/:id/archivos/:fileId`, autorizado para propietario o Especialista vigente.
- `GET /solicitudes-recibidas`, `GET /solicitudes-recibidas/:id`, `POST /solicitudes-recibidas/:id/decidir`. El último acepta review/return/resolve/unblock únicamente para el Especialista autorizado. No es un permiso de Soporte Digital para resolver su propia solicitud.

## Resultados finales

La migración `0093` se aplicó correctamente en desarrollo. Typechecks de backend y frontend aprobados. Builds de backend y frontend aprobados; Vite muestra una advertencia de tamaño del bundle principal (1.612 kB sin gzip). **Regresión: 180/180 pruebas aprobadas en 12 suites**, en base aislada, sin fallos ni pruebas omitidas. Las 23 pruebas nuevas de API también pasaron en una ejecución inicial separada. `git diff --check` no reportó problemas.

Comando de regresión ejecutado desde la raíz:

```text
npm test -- tests/soporteDigitalRequests.test.ts tests/soporteDigitalWork.test.ts tests/soporteDigitalHome.test.ts tests/soporteEditorialRequests.test.ts tests/correctorRequests.test.ts tests/editorRequests.test.ts tests/editorialRequests.lifecycle.test.ts tests/workItems.test.ts tests/notificaciones.routes.test.ts frontend/src/soporteDigital/soporteDigitalMisSolicitudes.test.tsx frontend/src/soporteDigital/soporteDigitalMiTrabajo.test.tsx frontend/src/soporteDigital/soporteDigitalHome.test.tsx --hookTimeout=120000 --testTimeout=120000 --reporter=dot
```

Duración reportada: 1264,16 s. Backend: 139 pruebas. Frontend SSR: 41 pruebas. No se declara una ejecución completa de todas las suites del repositorio: se ejecutó la regresión de los módulos afectados y sus consumidores compartidos.

Smoke HTTP local: `http://localhost:5173/?vista=mis-solicitudes` responde 200 y el endpoint real `http://localhost:3000/api/soporte-digital/mis-solicitudes` responde 401 sin sesión. Esto confirma disponibilidad de las rutas y control de sesión; no representa una revisión visual autenticada.

## Inventario final

El estado inicial contenía 11 archivos modificados de Mi trabajo y tres archivos sin seguimiento: el informe anterior, `soporteDigitalActions.ts` y `scripts/reset-soporte-digital-password.ts`. Se conservaron íntegros salvo la ampliación autorizada del catálogo de auditoría. El script de contraseña no se ejecutó.

Archivos nuevos de esta entrega:

- `shared/soporteDigitalRequests.ts`.
- `server/db/schema/solicitudArchivos.ts`.
- `server/db/migrations/0093_digital_requests.sql`.
- `server/helpers/soporteDigitalRequests.ts`.
- `server/routes/soporteDigitalRequests.routes.ts`.
- `frontend/src/soporteDigital/soporteDigitalRequestsApi.ts`.
- `frontend/src/soporteDigital/SoporteDigitalMisSolicitudes.tsx`.
- `frontend/src/soporteDigital/soporteDigitalMisSolicitudes.css`.
- `tests/soporteDigitalRequests.test.ts`.
- `frontend/src/soporteDigital/soporteDigitalMisSolicitudes.test.tsx`.
- `docs/reportes/soporte-digital-mis-solicitudes.md`.

Archivos existentes modificados en esta entrega: `frontend/src/HomePage.tsx`, `frontend/src/soporteDigital/SoporteDigitalUi.tsx`, `frontend/src/soporteDigital/soporteDigitalHome.test.tsx`, `server/app.ts`, `server/db/migrations/meta/_journal.json`, `server/db/schema/index.ts`, `server/db/schema/operacionEspecialista.ts` y `server/helpers/auditLog.ts`.

`git diff --stat` total del workspace: **18 archivos con seguimiento, 544 inserciones y 115 eliminaciones**, incluyendo el trabajo previo de Mi trabajo. Los 11 archivos nuevos de esta entrega aún no están versionados y por ello no figuran en ese stat. `git status --short`: 18 modificados y 14 sin seguimiento; estos últimos incluyen los tres archivos que ya estaban sin seguimiento al iniciar. No hay stage ni commit.

Salida de `git diff --stat` (incluye cambios anteriores):

```text
 frontend/src/HomePage.tsx                          |   2 +
 .../src/soporteDigital/SoporteDigitalMiTrabajo.tsx | 124 +++++++++++-----
 frontend/src/soporteDigital/SoporteDigitalUi.tsx   |   9 +-
 .../src/soporteDigital/soporteDigitalHome.test.tsx |   2 +-
 .../src/soporteDigital/soporteDigitalMiTrabajo.css |  75 ++++++++++
 .../soporteDigitalMiTrabajo.test.tsx               |  26 +++-
 .../src/soporteDigital/soporteDigitalWorkApi.ts    |  18 +--
 server/app.ts                                      |   2 +
 server/db/migrations/meta/_journal.json            |   7 +
 server/db/schema/index.ts                          |   1 +
 server/db/schema/operacionEspecialista.ts          |  10 +-
 server/helpers/auditLog.ts                         |   3 +
 server/helpers/soporteDigitalDrive.ts              |  18 ++-
 server/helpers/soporteDigitalHome.ts               |  27 +++-
 server/helpers/soporteDigitalWork.ts               | 128 ++++++++++++-----
 server/routes/soporteDigitalWork.routes.ts         |  22 ++-
 shared/soporteDigitalWork.ts                       |  28 ++++
 tests/soporteDigitalWork.test.ts                   | 157 ++++++++++++++++++++-
 18 files changed, 544 insertions(+), 115 deletions(-)
```

Salida de `git status --short`:

```text
 M frontend/src/HomePage.tsx
 M frontend/src/soporteDigital/SoporteDigitalMiTrabajo.tsx
 M frontend/src/soporteDigital/SoporteDigitalUi.tsx
 M frontend/src/soporteDigital/soporteDigitalHome.test.tsx
 M frontend/src/soporteDigital/soporteDigitalMiTrabajo.css
 M frontend/src/soporteDigital/soporteDigitalMiTrabajo.test.tsx
 M frontend/src/soporteDigital/soporteDigitalWorkApi.ts
 M server/app.ts
 M server/db/migrations/meta/_journal.json
 M server/db/schema/index.ts
 M server/db/schema/operacionEspecialista.ts
 M server/helpers/auditLog.ts
 M server/helpers/soporteDigitalDrive.ts
 M server/helpers/soporteDigitalHome.ts
 M server/helpers/soporteDigitalWork.ts
 M server/routes/soporteDigitalWork.routes.ts
 M shared/soporteDigitalWork.ts
 M tests/soporteDigitalWork.test.ts
?? docs/reportes/soporte-digital-mi-trabajo-continuacion.md
?? docs/reportes/soporte-digital-mis-solicitudes.md
?? frontend/src/soporteDigital/SoporteDigitalMisSolicitudes.tsx
?? frontend/src/soporteDigital/soporteDigitalMisSolicitudes.css
?? frontend/src/soporteDigital/soporteDigitalMisSolicitudes.test.tsx
?? frontend/src/soporteDigital/soporteDigitalRequestsApi.ts
?? scripts/reset-soporte-digital-password.ts
?? server/db/migrations/0093_digital_requests.sql
?? server/db/schema/solicitudArchivos.ts
?? server/helpers/soporteDigitalActions.ts
?? server/helpers/soporteDigitalRequests.ts
?? server/routes/soporteDigitalRequests.routes.ts
?? shared/soporteDigitalRequests.ts
?? tests/soporteDigitalRequests.test.ts
```
