# Soporte Editorial Mis solicitudes

28 de octubre de 2026, America/Caracas. Pantalla implementada: **Soporte Editorial / Validador → Mis solicitudes**. Se reutilizan `solicitudes_area`, `informacion_solicitud_area`, auditoría y notificaciones. Una fila representa una solicitud propia y conserva su ronda de origen; no representa una validación ni un ticket independiente.

El repositorio partía de `d216b3d` con los cambios sin commit de la iteración anterior de Mi trabajo. Se revisaron status, diff, estadísticas y los últimos 15 commits antes de editar. No se revirtieron esos cambios. Las estadísticas contra HEAD son acumulativas; el inventario específico de esta iteración se detalla abajo.

## Decisiones de dominio

El flujo de Calidad ya identifica material diagramado, fuente, versiones y coordinación por el Especialista (`server/helpers/calidad.ts`, `diseno.ts` y `docs/arquitectura/14-fase5-calidad.md`). Los problemas de material, las aclaraciones operativas y el acceso a archivos encajan en ese flujo. Se adoptó la convención de nombres de los requests existentes, sin reutilizar los tipos de Editor o Corrector:

- `calidad_material`: material incorrecto o faltante.
- `calidad_aclaracion`: aclaración operativa.
- `calidad_tecnico`: problema de acceso o archivo.

Todos llegan al Especialista coordinador vigente. Este coordina la atención con Diseño cuando corresponde. No hay directorio global ni destino enviado por el cliente. No se añadió una categoría redundante de imposibilidad de validar, prioridad, chat, checklist o severidad.

Las rondas de Calidad siguen siendo compartidas por rol, conforme a la decisión documentada del 8/10/2026. Las **solicitudes** sí son privadas por creador. No se fabricó una asignación individual para negar a otro Validador una ronda que el dominio define como compartida.

## Informe obligatorio

| Punto | Resultado |
| --- | --- |
| A. Estado previo | No existía Mis solicitudes de Soporte Editorial. HomePage solo enrutaba Inicio/Mi trabajo; la navegación omitía el enlace y no había API propia de requests de Calidad. |
| B. Schema encontrado | `solicitudes_area`: proyecto, work item, tipo, business key, creador, destinatario, descripción, estado, timestamps, resolución, motivo y versión optimista. `informacion_solicitud_area`: pregunta/respuesta con actores y fechas. Se agregó `asunto` nullable para conservar compatibilidad con los demás roles. |
| C. Union de tipos | Preexistían lanzamiento, impresion, creativa, editor, editor_apoyo, editor_reasignacion, editor_aclaracion, corrector_material, corrector_aclaracion y corrector_tecnico. Se agregaron exclusivamente los tres `calidad_*`; CHECK SQL y contrato TypeScript coherentes. |
| D. Lifecycle existente | pendiente → en_revision explícita; requiere_informacion → respuesta → pendiente; resolución/cancelación terminales. `rechazada` ya existe y se conserva como lectura, sin añadir una acción de rechazo nueva. |
| E. Tipos habilitados | Material incorrecto o faltante, aclaración operativa y problema de acceso o archivo. Son los únicos admitidos en la API de creación. |
| F. Tipos descartados | No se reutilizan editor/corrector_*. Sin Otro libre, prioridad ni Imposibilidad de validar duplicando el bloqueo. No se copiaron etiquetas de la imagen sin contrastarlas con el dominio. |
| G. Target/destination | Backend deriva Especialista mediante historial de asignación canónico, con fallback al FK únicamente cuando no existe historial. Crear requiere coordinador activo de rol especialista. Reasignaciones cambian el receptor autorizado; el Validador no modifica target. |
| H. Project | Derivado del work item y de la Ficha; la API no acepta projectId arbitrario. Trigger SQL comprueba coincidencia proyecto/work item/ronda. |
| I. Work item | Obligatorio, tipo calidad y asociado a una ronda real. No se crea trabajo adicional al enviar una solicitud. |
| J. Quality phase/ronda | Se obtiene de `ficha_calidad_fases.work_item_id`, único. No se duplica qualityPhaseId en solicitudes_area. Prueba y QA con F2, ronda 2, archivo V3. La solicitud sigue referenciando esa ronda al cerrarse la revisión. |
| K. Assignment | No hay assignment individual de Validador en el workflow aprobado. Se reutiliza la asignación de Especialista; no se añadió assignmentId ficticio. |
| L. Blocker vs request | La solicitud no crea ni resuelve bloqueos y no pausa SLA automáticamente. Una ronda bloqueada puede reportar su necesidad. No se duplica la entidad de bloqueo. |
| M. Backend list | `GET /api/calidad/mis-solicitudes`. Scope por requested_by_id y tipos calidad_* antes de filtrar/paginar. Una consulta SQL agrega counts, opciones y página. |
| N. Backend detail | `GET /api/calidad/mis-solicitudes/:id`. Solo dueño; 404 para otro Validador o ID inexistente. Carga diferida de preguntas, historial y resolución/referencia. |
| O. Create flow | Desde Nueva solicitud o Reportar problema de la ronda. Selector paginado de contextos abiertos, tipo controlado, tema y descripción. El servidor revalida vigencia bajo el mismo bloqueo de proyecto usado por Calidad/Diseño. |
| P. Update returned | `POST .../:id/responder`: pregunta concreta, expectedVersion y respuesta. Se completa la misma solicitud; la respuesta original no se edita silenciosamente. Actores, fechas y eventos se conservan. |
| Q. Cancel flow | `POST .../:id/cancelar`: propia y todavía abierta, incluyendo devuelta. No DELETE. Estado cancelada, actor/fecha en campos canónicos de cierre, motivo opcional en outcome/audit. Confirmación de UI con snapshot de versión. |
| R. Row DTO | Request ID, tipo, tema, proyecto/autor/código/portada, work item, quality phase, fase/ronda, versionLabel, estado, fechas, último evento, requiresAction, canCancel y workAccessible. `version` es concurrencia del request, no versión del PDF. Sin descripción extensa, preguntas ni historial en el listado. |
| S. Detail DTO | Descripción original, destino, coordinador/diseñador, preguntas y respuestas, historial, resultado con actor/fecha/referencia y cancelación. No arrays de archivos ni mensajes inventados. |
| T. Tabs | Todas, Pendientes, Requieren tu acción, Resueltas y Canceladas. Pendientes incluye pendiente/en_revision; acción corresponde a requiere_informacion; resueltas incluye la lectura de rechazada si existiera. |
| U. Counts | Calculados en PostgreSQL sobre todos los resultados filtrados, antes de LIMIT/OFFSET. No sobre la página visible. |
| V. Search | Debounce de 300 ms; servidor busca proyecto, autor, código, tipo/etiqueta, tema, ronda y versión. Sin búsqueda por nombre de archivo. |
| W. Filters | Estado, tipo, proyecto y fechas desde/hasta. Fechas interpretadas en America/Caracas; rango inválido devuelve 400. No prioridad ni filtro de Validador. |
| X. Pagination | Server-side 10/25/50, default 25 conforme al patrón de solicitudes existente. Página fuera de rango ajustada. QA con 15 solicitudes propias y páginas de 10/5. |
| Y. Sorting | Requiere información primero, luego pendiente/en_revision, resultados y canceladas; última actualización descendente e ID estable. |
| Z. Selected row | Click, Enter o Espacio seleccionan sin transicionar estado. Acento PanHouse discreto. URL conserva tab, filtros, búsqueda, página, request y pestaña del detalle. |
| AA. Detail tab | Contexto, tema, descripción sin reescritura, destino, responsables, fechas, información solicitada/completada, resolución/cancelación y acciones permitidas. Completar información dirige el foco al formulario. |
| AB. Files tab | Omitida deliberadamente: no existe infraestructura de adjuntos de solicitudes. El PDF comentado de Calidad es un entregable de la ronda y no se reutilizó como evidencia de request. |
| AC. Comments/Messages | No hay modelo de comentarios libres de request. Se muestran las preguntas/respuestas reales de informacion_solicitud_area en Detalle; no chat, Mensajes ni nueva tabla de comentarios. |
| AD. History tab | Timeline real de creación, inicio explícito, devolución, información completada, resolución o cancelación, con actor/fecha y explicación cuando existe. Leer no agrega eventos. |
| AE. Result/resolution | Bloque Resultado con texto, responsable y fecha. Resueltas/canceladas son de solo lectura; el Validador nunca ve comandos de resolución. |
| AF. Result references | Resolución puede asociar una ronda ya existente del mismo proyecto. Backend valida pertenencia y la guarda estructurada en audit; detalle recupera la relación y permite volver a esa validación. No crea nueva ronda/material al resolver. |
| AG. Attachments | No se implementa uploader, almacenamiento ni enlaces libres porque no hay infraestructura canónica. Campos attachments/fileId son rechazados por el schema estricto. |
| AH. Drive/file authorization | Esta pantalla no recibe ni abre archivos y no consulta Drive. No existe vía de adjuntar archivos ajenos por ID. Ver validación conduce al dominio autorizado de materiales; no expone raíz ni directorio Drive. |
| AI. Deep link a Mi trabajo | Ver validación abre `/?vista=mi-trabajo&workItem=<qualityPhaseId>`, la identidad que consume la selección existente. Reportar problema pasa el workItemId canónico al formulario contextual. QA de ida y vuelta confirmado. |
| AJ. Desde notifications | Avisos al Validador llevan request seleccionado en Mis solicitudes; al coordinador, `/?vista=solicitudes&qualityRequest=<id>`. Se comprobó un clic real de notificación de resolución que abrió el mismo ID. |
| AK. Duplicate prevention | Unicidad parcial por creador/work item/tipo mientras está pendiente, en revisión o requiere información, más comprobación de dominio dentro de la transacción. |
| AL. Idempotency | UUID de envío por formulario. Repetir la misma clave/payload devuelve el ID existente sin duplicar audit/aviso; cambiar payload con esa clave genera 409. Índice adicional por creador/business key. |
| AM. Concurrency | Bloqueo de proyecto y request, expectedVersion y comprobación del estado. Pruebas concurrentes; UI comprobada con confirmación de cancelación abierta antes de que el Especialista resolviera: 409, refresh de queries y resultado preservado. |
| AN. Audit | Seis eventos CALIDAD_REQUEST_* para creación, revisión, devolución, respuesta, resolución y cancelación. Se reutiliza audit_logs con entity_type solicitud y el ID del request. |
| AO. Notifications | Aviso al coordinador al crear, responder o cancelar; al Validador al iniciar revisión, pedir información o resolver. Solo en transiciones confirmadas, sin avisos por lectura ni duplicados de reintentos. |
| AP. RBAC | Solo soporte_editorial crea y gestiona su outbox. Solo especialista actual del proyecto recibe/decide. Se verifica rol activo en los comandos. El solicitante no resuelve su propia solicitud. |
| AQ. IDOR | Tests de request ajena: lista vacía y detalle/acciones 404. Otros roles 403/anónimo 401. Work item inexistente/no Calidad 404; proyecto/fase/target/fileId arbitrarios no aceptados. Especialista ajeno o anterior a reasignación no decide. Las rondas compartidas del rol no se tratan como asignaciones privadas inexistentes. |
| AR. Performance | Listado SQL paginado y proyección acotada; detalle lazy. Contextos elegibles e inbox del coordinador también paginados. TanStack Query con claves por usuario e invalidación tras comandos, refetch periódico/focus para cambios de otra sesión. |
| AS. N+1 audit | Test espía comprueba una consulta SQL para listado con 13 requests. Joins/agregados de autores y último evento; sin consultas por fila a especialistas/historial/Drive. El detalle hace sus consultas solo para la solicitud seleccionada. |
| AT. Tests | 18 tests nuevos backend y 9 frontend propios; regresión ampliada de 237 tests en 19 archivos. Última corrida focal: 49/49 en requests y frontend de Soporte Editorial. Las corridas se solapan y no se suman como pruebas distintas. |
| AU. Typecheck | Backend y frontend correctos, incluyendo tests. |
| AV. Builds | Backend y frontend correctos. Vite conserva el aviso de chunks mayores de 500 kB, sin error de compilación. Drizzle confirma No schema changes después de incorporar el snapshot de 0092. |
| AW. QA 1440 | Chromium real 1440×900; master-detail, lista predominante, badges, campos y acciones. Sin desbordamiento horizontal. Creación desde ronda y respuesta entre dos sesiones de roles reales contra API/DB de QA. |
| AX. QA 768 | Chromium real 768×1024; tabla completa, drawer modal de 440 px, foco circular y Escape comprobados. Documento de 768 px. |
| AY. QA 375 | Chromium real 375×812; cards compactas sin tabla horizontal, detalle completo y formularios nativos. Creación técnica, cancelación con motivo, notificación y timeline comprobados. Documento de 375 px. |
| AZ. Correcciones tras QA | Fechas compactas y anchos de columnas, labels sin cortar palabras, CTA visible para completar información, formularios sin dos traps simultáneos, foco circular/Escape de modal anidado, header del modal accesible al desplazar y conservación de respuesta sin enviar al alternar Detalle/Historial. |
| BA. Archivos tocados | Inventario específico abajo y status completo en evidencias. Los cambios previos de Mi trabajo permanecen intactos salvo la integración requerida Reportar problema. |
| BB. git diff --stat | Snapshot final en `../evidencias/soporte-editorial-mis-solicitudes/git-diff-stat.txt`, acumulativo respecto de HEAD. Nuevos archivos sin seguimiento no figuran en ese comando; se acompañan de inventario. |
| BC. git status | Snapshot final en `../evidencias/soporte-editorial-mis-solicitudes/git-status.txt`. Sin commit ni publicación. La migración aditiva 0092 se aplicó localmente; no se insertaron solicitudes de QA en desarrollo. |

## Integraciones mínimas de alcance

- Navegación compartida y HomePage: activar la ruta real y el tercer enlace, sin rediseñar Inicio ni el shell.
- Mi trabajo: únicamente el enlace contextual Reportar problema.
- Especialista: montar un receptor de Calidad en el panel de solicitudes existente para que el circuito de devolución/respuesta/resolución sea operable. Sin rediseñar su pantalla. Se filtraron explícitamente los tipos del agregado nativo para no mezclar solicitudes enviadas por el Especialista con las recibidas del Validador.
- Infraestructura compartida: asunto, tipos/check, índices y trigger contextual, audit y registro de rutas. Sin otro sistema de tickets ni cambios de ejecución en Diseño/Calidad.

## Inventario específico

Nuevos:

```text
shared/soporteEditorialRequests.ts
server/helpers/soporteEditorialRequests.ts
server/routes/soporteEditorialRequests.routes.ts
server/db/migrations/0092_quality_requests.sql
server/db/migrations/meta/0092_snapshot.json
frontend/src/soporteEditorial/SoporteEditorialMisSolicitudes.tsx
frontend/src/soporteEditorial/QualityIncomingRequests.tsx
frontend/src/soporteEditorial/soporteEditorialRequestsApi.ts
frontend/src/soporteEditorial/soporteEditorialMisSolicitudes.css
frontend/src/soporteEditorial/soporteEditorialMisSolicitudes.test.tsx
tests/soporteEditorialRequests.test.ts
scripts/soporte-editorial-requests-qa.ts
docs/auditoria/36-soporte-editorial-mis-solicitudes.md
docs/evidencias/soporte-editorial-mis-solicitudes/
```

Integraciones modificadas:

```text
server/db/migrations/meta/_journal.json
server/db/schema/operacionEspecialista.ts
server/helpers/auditLog.ts
server/helpers/especialistaSolicitudes.ts
server/routes/calidad.routes.ts
frontend/src/HomePage.tsx
frontend/src/especialista/SolicitudesPage.tsx
frontend/src/soporteEditorial/SoporteEditorialUi.tsx
frontend/src/soporteEditorial/SoporteEditorialMiTrabajo.tsx
frontend/src/soporteEditorial/soporteEditorialHome.test.tsx
```

## Evidencias y reproducción

Pruebas funcionales/visuales con API Fastify y PostgreSQL reales en `panhouse_calidad_preview_20261028`, aislada de desarrollo. Cuenta Validador de QA en 127.0.0.1:5175; sesión independiente del Especialista en 127.0.0.2:5176, ambas con proxy a la API 3013. No se alteraron las credenciales de los usuarios de desarrollo ni las cookies del sitio habitual en localhost:5173. Los datos de prueba se identifican como QA; no se copiaron personas, proyectos, archivos o cantidades de la imagen.

Preparación:

```text
npx tsx scripts/soporte-editorial-work-qa-server.ts
npx tsx scripts/soporte-editorial-requests-qa.ts
```

El segundo script agrega escenarios solo si no existen solicitudes de Calidad en esa base y no reescribe las revisiones manuales de QA. Las pruebas automatizadas usan la base de test separada y no dependen de esos escenarios.

Capturas y resultados: `docs/evidencias/soporte-editorial-mis-solicitudes/`. Se comprobaron creación contextual F2.2/V3, devolución y respuesta sobre el mismo ID, resolución con referencia existente, cancelación sin borrar, conflicto de versión, navegación desde notificación, retorno a la validación, búsqueda, filtros, paginación, estados vacíos y teclado.

## Límites documentados

No existe un modelo de adjuntos de solicitudes ni una API autorizada para asociar evidencias por fileId. Por la regla explícita de implementar archivos solo si hay infraestructura real, no se crea uploader ni tab Archivos. Su incorporación futura requiere definir almacenamiento y autorización por request/proyecto/workspace; los materiales de la ronda siguen en Mi trabajo.

No se creó una asignación individual de Validador: la bandeja de rondas permanece compartida conforme al dominio aprobado. La privacidad de Mis solicitudes se aplica a la entidad request y su historial, no inventando ownership de rondas.
