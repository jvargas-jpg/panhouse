# Portal del Autor — entrega y verificación

Fecha: 11 de noviembre de 2026. Workspace: `C:\Users\PC\Documents\Panhouse`.

## Resultado

El Autor participa mediante una cuenta controlada, proyectos canónicos, documentos liberados expresamente, solicitudes de decisión y solicitudes de pausa. El backend registra las decisiones, actualiza las fuentes operativas existentes, notifica al responsable y conserva el historial. La interfaz del Autor tiene seis áreas y no utiliza Project 360.

Implementación y migraciones aplicadas localmente. No se hizo commit ni despliegue remoto. El correo real requiere configurar SMTP; la cola persistente, el transporte, los templates y los reintentos están implementados y probados con transporte simulado.

## Auditoría y reutilización

La auditoría previa está en `docs/arquitectura/42-portal-autor.md`.

- Stack existente: Fastify, PostgreSQL/Drizzle, sesiones opacas, Argon2, React/React Query y BullMQ/Redis.
- El rol `autor` ya existía. No se creó otro rol ni otra entidad de autor o proyecto.
- Base de desarrollo al iniciar: 163 autores, 139 proyectos, 143 asociaciones de coautoría y ninguna cuenta Autor. No había vínculos de usuario duplicados. No se inventó ningún vínculo por coincidencia de correo.
- Se reutilizan `usuarios.autor_id`, `autores`, `proyectos.autor_id` y `proyectos_autores`. La cuenta puede ver proyectos como autor principal o coautor explícito.
- Se reutilizan `project_assignments` para resolver responsables, `work_items` para las esperas y tareas, `notificaciones`, `audit_logs`, `solicitudes_area` y `pausas`.
- Las decisiones existentes de Jefatura tienen restricciones para dos procesos internos concretos; no podían representar aprobaciones del Autor sin romper ese contrato.
- La antigua portada guardaba una decisión mutable en columnas del proyecto. Esas columnas permanecen como legado, sin fabricar versiones, responsables ni fechas históricas.
- La cola previa enviaba WhatsApp y no existía transporte SMTP.
- Drive corporativo ya estaba conectado y su raíz configurada. Se conserva esa integración, su cifrado y sus permisos.

## Modelos nuevos y motivos

| Modelo | Motivo |
| --- | --- |
| `approval_requests` | Solicitud genérica, destinatario, origen operativo, plazo, predecesora, decisión, feedback y registro externo. |
| `approval_artifacts` | Una solicitud puede involucrar varios documentos/revisiones. |
| `author_documents` | No existía una autorización documental por destinatario con revisión exacta e inmutable. |
| `author_credential_tokens` | La autenticación existente no tenía activación ni recuperación de credenciales con token de un solo uso. |
| `author_mail_outbox` | Persistencia transaccional de avisos, deduplicación, reintentos y recuperación ante fallos del transporte. |

Las solicitudes de pausa amplían `solicitudes_area` con el tipo `autor_pausa`, fechas solicitadas y una FK a la pausa canónica. No se creó un sistema de pausas paralelo.

## Cuenta, autenticación y RBAC

- Una cuenta Autor por `autor_id`, garantizada mediante índice único parcial.
- Invitación desde el proyecto por su Especialista vigente o Jefatura. Se valida la relación del destinatario con el proyecto y la disponibilidad del correo. Una cuenta existente se reutiliza para todos sus libros.
- La cuenta invitada nace inactiva con una credencial aleatoria no utilizable. La activación establece la contraseña mediante Argon2 y habilita la misma cuenta de `usuarios`.
- Tokens aleatorios de 256 bits, hash SHA-256 en la entidad de credenciales, expiración y consumo único. Activación: 48 horas. Recuperación: 1 hora.
- El enlace de credenciales usa fragmento, no query string. El fragmento no llega a los access logs. El outbox limpia el enlace de credenciales después de enviarlo y elimina correos de credenciales pendientes que hayan sido sustituidos.
- Recuperación con respuesta uniforme y limitación por IP. No existe registro público ni reclamación de proyectos.
- Desactivar la cuenta desde Administración revoca sesiones, tokens pendientes y sus correos de credenciales. El Especialista no puede reactivar mediante invitación una cuenta previamente desactivada.
- Todas las rutas del portal validan sesión, rol y pertenencia. Los documentos y aprobaciones requieren, además, destinatario exacto.
- El Autor tiene una lista permitida de APIs. No puede consultar usuarios, auditoría, carga, Project 360, carpetas Drive, matrices ni modificar proyectos o estados directamente.
- Los DTO del portal se construyen mediante listas explícitas de campos. No se envían campos internos para ocultarlos luego con React.
- `Ver como Autor` conserva el modo administrativo de solo lectura y permite salir de la vista.

## Motor de aprobaciones y workflow

Tipos representables: estructura, capítulo, Tripa Completa, Kit Editorial, Brief Creativo, concepto de portada, Muestra de Diagramación, Cubierta Extendida, versión validada, aprobación final y otro entregable editorial.

El backend verifica el servicio cuando corresponde, el origen canónico, la revisión interna necesaria y la versión de Diseño vigente. No puede publicarse una cubierta sin validaciones internas ni una versión diagramada sin Calidad.

Crear una solicitud registra los artefactos, la fecha de envío canónica, la espera operativa y los avisos en una transacción. El proyecto no se duplica. La espera tiene un work item `aprobacion_autor` y el origen muestra el gate `ESPERANDO_AUTOR`.

Al decidir:

- **Aprobar** permite comentario opcional.
- **Solicitar cambios** exige feedback en backend y frontend.
- El proyecto se bloquea transaccionalmente para serializar decisiones concurrentes. Una segunda decisión recibe 409.
- Las decisiones resueltas y las referencias documentales tienen protección de inmutabilidad en PostgreSQL.
- Brief y conceptos actualizan sus entidades canónicas y avisan al Especialista y al Líder Creativo asignado cuando corresponde.
- Feedback de capítulos devuelve la intervención editorial al Editor; la aprobación completa el trabajo del capítulo.
- La aprobación de Tripa Completa actualiza el hito existente y habilita los gates posteriores de planificación.
- Muestra y cubierta aprobadas cierran sus trabajos de Diseño. El feedback reabre el trabajo para ajustes y avisa al Diseñador responsable.
- Aprobar la versión validada crea la Revisión Final de Calidad mediante una operación compartida con el coordinador existente. No se fabrican números legales ni resultados de Calidad.
- Las asignaciones y los datos que otros procesos necesitan siguen bajo sus comandos existentes. La aprobación no inventa una contratación, un empleado o un archivo siguiente.

Las versiones sucesoras conservan el vínculo con la solicitud anterior, su feedback y sus artefactos. Se rechaza reutilizar exactamente la misma revisión como si fuera una versión nueva. Una solicitud puede retirarse con explicación y auditoría; retirar un documento cancela sus solicitudes abiertas y conserva el historial.

Los atajos antiguos de envío/decisión quedan bloqueados para proyectos de Autores incorporados al portal. Los proyectos aún no incorporados conservan compatibilidad con el workflow heredado durante la adopción.

## Deadlines y métricas

- El plazo vencido no aprueba, rechaza, cancela ni cierra solicitudes. Tampoco avanza gates. El Autor puede responder tarde.
- La UI muestra el retraso y conserva ambos botones de decisión.
- Se reutilizan los plazos existentes de capítulos —3 días hábiles— y Tripa Completa —5 días hábiles—. Para los demás entregables el responsable establece el plazo explícitamente; no se inventa un calendario comercial.
- La auditoría guarda espera, demora y, para registros externos, demora de transcripción. La fecha de decisión externa corresponde a la recepción declarada; la auditoría conserva cuándo se registró.
- Especialista y Jefatura ven pendientes, vencidas y media de respuesta en horas calendario. Esa media no se presenta como desempeño ni como SLA ajustado.
- Las pausas se registran en la tabla que ya utilizan los cálculos de duración efectiva. Los recordatorios automáticos se suspenden durante una pausa activa.

## Documentos y Drive

Cada documento compartido tiene proyecto, Autor destinatario, título, etiqueta de versión, Drive file ID, revisión fijada, MIME y actor de liberación. No se identifica mediante el nombre del archivo.

Antes de compartir se verifica que el archivo pertenezca al espacio Drive del proyecto. Se fija su revisión binaria con `keepForever`. El Autor recibe un endpoint autenticado que lee esa revisión exacta mediante la integración corporativa. No se abre la carpeta ni se conceden permisos generales al Autor. El backend vuelve a comprobar la autorización después de la lectura remota.

Se admiten PDF, PNG y JPEG de hasta 50 MB. Los documentos nativos de Google deben entregarse como PDF/imagen en esta implementación. Un enlace a su contenido mutable no se presenta como una revisión histórica exacta.

Los documentos internos no se listan automáticamente. Los aprobados se reconocen a partir de las decisiones canónicas, y existe categoría de entregable final. La revocación impide nuevas lecturas.

**Prueba con Drive real:** se creó un archivo temporal bajo una carpeta de QA identificada, se fijó una revisión y se verificó igualdad SHA-256 de los bytes leídos. Se eliminaron únicamente ese archivo y esa carpeta. Resultado completo en `docs/evidencias/portal-autor/drive-smoke.json`.

## Solicitudes y decisiones externas

El Autor envía motivo, inicio deseado, regreso estimado opcional y comentario. El envío no crea una pausa ni cambia el estado del proyecto. La solicitud queda pendiente y llega al Especialista vigente; si falta responsable, se eleva a Jefatura.

La resolución autorizada exige respuesta. Aprobar registra una fila en `pausas`; una pausa formal exige Jefatura y confirmación de pago, conforme a las reglas existentes. La UI interna confirma que la pausa aprobada comienza desde ese momento; las fechas deseadas se mantienen como solicitud, sin programar silenciosamente un cambio futuro.

El Autor puede consultar respuesta, fecha efectiva y reanudación cuando exista. No se implementó chat ni otros tipos de solicitud no confirmados.

Para registrar decisiones de correo/WhatsApp se exigen decisión, canal, fecha, evidencia y motivo manual. El actor registrado es el Especialista/Jefatura real. La aprobación conserva los mismos artefactos y no simula un login del Autor.

## Notificaciones y correo

Los avisos del Autor siempre tienen usuario destinatario. El portal no consume broadcasts internos. Las notificaciones de decisión y feedback se dirigen al Especialista actual y, cuando corresponde, al responsable del trabajo.

Se implementaron invitación/activación, recuperación, nueva aprobación, nueva versión, decisión recibida, recordatorio, recepción/resolución de pausa e hitos de Diseño, preparación final y publicación.

El worker existente incorpora la cola `author-portal`. Un scheduler BullMQ despierta cada minuto el procesamiento del outbox y recordatorios. Hay deduplicación de avisos, un recordatorio previo, otro al vencer y aviso al Especialista. El recordatorio manual se limita a uno por fecha de Caracas y solicitud. Los fallos SMTP se reintentan después de 15 minutos; no se pierde la decisión ni el aviso interno.

Configurar en el entorno local/de despliegue:

```dotenv
SMTP_URL=...
MAIL_FROM=...
AUTHOR_REMINDER_BEFORE_HOURS=12
```

Después iniciar/reiniciar backend y `npm run worker`. Sin SMTP, los correos permanecen pendientes; el sistema no declara que fueron enviados.

## Rutas

UI: `/autor`, `/autor/proyectos`, `/autor/proyectos/:id`, `/autor/aprobaciones`, `/autor/aprobaciones/:id`, `/autor/documentos`, `/autor/solicitudes`, `/autor/notificaciones`, `/autor/activar`, `/autor/recuperar`. `/mis-libros` redirige al portal; el enlace antiguo de detalle utiliza la nueva vista segura.

APIs bajo `/api/autor`:

| Método | Ruta | Alcance |
| --- | --- | --- |
| GET | `/projects`, `/projects/:id` | Proyectos propios y DTO de detalle. |
| GET | `/approvals`, `/approvals/:id` | Decisiones propias e historial. |
| POST | `/approvals/:id/decision` | Decisión del destinatario autenticado. |
| GET | `/documents`, `/documents/:id/content` | Documentos expresamente liberados y revisión exacta. |
| GET | `/requests` | Solicitudes propias. |
| POST | `/projects/:id/pause-requests` | Solicitar una pausa. |
| GET / POST | `/notifications`, `/notifications/:id/read` | Avisos del usuario / marcar leído. |
| POST | `/credentials/activate`, `/credentials/reset` | Activación mediante token / recuperación. |
| GET | `/internal/projects/:id` | Misma información de participación para responsables autorizados. |
| POST | `/internal/projects/:id/invite` | Alta/invitación controlada. |
| POST | `/internal/projects/:id/documents` | Liberar una revisión de Drive. |
| POST | `/internal/projects/:id/approvals` | Solicitar decisión sobre origen canónico. |
| POST | `/internal/documents/:id/revoke` | Retirar documento. |
| POST | `/internal/approvals/:id/external-decision` | Contingencia auditada. |
| POST | `/internal/approvals/:id/remind`, `/internal/approvals/:id/cancel` | Recordatorio / retiro justificado. |
| POST | `/internal/requests/:id/resolve` | Resolver solicitud de pausa. |

## Verificación

- Regresión general inicial: **2.131 pruebas aprobadas**; 10 expectativas del portal antiguo y una fixture de Calidad fallaron. Se sustituyeron las expectativas retiradas por pruebas de denegación de las rutas antiguas y acceso al nuevo DTO; se corrigió la fixture que reutilizaba un work item único.
- Regresión posterior de las áreas afectadas: **251 pruebas aprobadas en 12 archivos**, sin fallos.
- Verificación posterior de portal y Administración frontend: **38 pruebas aprobadas en 3 archivos**.
- Última corrida del dominio y frontend del Autor: **15 pruebas aprobadas en 2 archivos**, sin fallos.
- Backend build y frontend build completados. Drizzle no detecta diferencias de schema pendientes. Migraciones aplicadas en desarrollo y en las bases de pruebas/preview.
- Pruebas con sesiones reales y PostgreSQL: ownership, coautoría, IDOR en comandos internos y del Autor, bloqueo de Project 360 y APIs internas, DTO limitado, versión exacta, comentarios obligatorios, concurrencia, historial inmutable, cancelación por revocación, recordatorios deduplicados, SMTP con reintento, invitación/activación/desactivación y ausencia de registro público.
- EF: estructura → cambios → nueva versión → aprobación; tres capítulos; Brief; conceptos con feedback y nueva versión; muestra; versión validada con feedback al Diseñador y posterior creación de Revisión Final.
- Browser QA: 1440×900, 768×1024 y 375×812; navegación y decisiones accesibles, sin overflow horizontal; confirmación, comentario obligatorio, decisión vencida desde móvil, deep link después de login y solicitud de pausa. Sin errores de navegador.
- Capturas y resultados: `docs/evidencias/portal-autor/`. La verificación final confirma una nueva versión pendiente y el mismo estado en Autor, Especialista y Jefatura.
- Preview usa una base aislada y PDFs sintéticos con autorización real del backend. No contiene documentos de clientes. La lectura de revisión contra Drive real se comprobó por separado.

## Vista local de QA

URL: `http://127.0.0.1:5183/autor`.

Usuarios de la base aislada: `elisa@author.qa.test`, `especialista@author.qa.test` y `jefatura@author.qa.test`. Contraseña de fixture local: `PanhousePreview2026!`. No son cuentas de la base de desarrollo ni credenciales de producción. `scripts/author-portal-qa-server.ts` permite reconstruir la preview; `scripts/author-portal-visual-qa.mjs` ejecuta el escenario visual.

## Decisiones de negocio / límites operativos

1. Configurar y comprobar el proveedor SMTP real. No se hizo un envío real sin esa configuración.
2. Confirmar el momento exacto de invitación y si Comercial debe obtener esa capacidad. Actualmente se realiza explícitamente desde Especialista/Jefatura.
3. Confirmar plazos de los entregables que no tienen calendario definido. Quedan pautados explícitamente por el responsable.
4. Confirmar si una obra con varios autores necesita quorum. Actualmente cada solicitud tiene un destinatario explícito y se evita abrir decisiones simultáneas para el mismo origen; no se inventó una votación.
5. La revisión exacta de documentos nativos de Google requiere exportación a PDF/imagen. No se amplió el acceso de carpetas para resolverlo.
6. El portal de pagos externo conserva su código legado, pero no se expone desde el portal del Autor de esta iteración.
7. El rate limit de credenciales es por proceso. Un despliegue con múltiples instancias debe conservar también sus controles de borde habituales.

## Migraciones

- `0097_quiet_luminals.sql`: aprobaciones, artefactos, documentos, credenciales, correo y extensión de solicitudes.
- `0098_groovy_golden_guardian.sql`: unicidad de cuenta por autor.
- `0099_author_portal_integrity.sql`: ampliación segura de restricciones heredadas y protección de inmutabilidad.
- `0100_fuzzy_centennial.sql`: retiro auditado de solicitudes y restricción de feedback.

No se eliminaron columnas antiguas ni se reconstruyeron aprobaciones históricas inciertas.

## Archivos y estado de Git

La sección siguiente contiene los comandos reales de cierre. `git diff --stat` cuenta los archivos ya seguidos por Git; los nuevos aparecen en `git status` y en el listado adicional.

### git diff --stat

```text
 .env.example                                       |   5 +
 frontend/src/App.tsx                               |  18 +-
 frontend/src/admin/AdminPeople.tsx                 |   4 +-
 frontend/src/auth/LoginPage.tsx                    |  10 +-
 frontend/src/auth/RequireAuth.tsx                  |   6 +-
 frontend/src/layout/TopBar.tsx                     |   2 +-
 frontend/src/portalAutor/AutorLayout.tsx           |  10 +-
 .../src/proyectos/ProyectoCommandCenterPage.tsx    |   2 +
 package-lock.json                                  |  21 ++
 package.json                                       |   2 +
 server/app.ts                                      |   4 +
 server/db/migrations/meta/_journal.json            |  28 ++
 server/db/schema/index.ts                          |   1 +
 server/db/schema/operacionEspecialista.ts          |   8 +-
 server/db/schema/users.ts                          |   5 +-
 server/helpers/calidad.ts                          |  10 +-
 server/middleware/auth.middleware.ts               |   3 +
 server/modules/admin/commands.ts                   |  10 +-
 .../modules/integrations/google-drive/adapter.ts   |  10 +
 .../modules/integrations/google-drive/provider.ts  |   2 +
 server/worker.ts                                   |   1 +
 shared/admin.ts                                    |   2 +-
 tests/portal.routes.test.ts                        |  20 +-
 tests/proyectos.routes.test.ts                     | 322 +--------------------
 24 files changed, 151 insertions(+), 355 deletions(-)
```

### git status --short

```text
 M .env.example
 M frontend/src/App.tsx
 M frontend/src/admin/AdminPeople.tsx
 M frontend/src/auth/LoginPage.tsx
 M frontend/src/auth/RequireAuth.tsx
 M frontend/src/layout/TopBar.tsx
 M frontend/src/portalAutor/AutorLayout.tsx
 M frontend/src/proyectos/ProyectoCommandCenterPage.tsx
 M package-lock.json
 M package.json
 M server/app.ts
 M server/db/migrations/meta/_journal.json
 M server/db/schema/index.ts
 M server/db/schema/operacionEspecialista.ts
 M server/db/schema/users.ts
 M server/helpers/calidad.ts
 M server/middleware/auth.middleware.ts
 M server/modules/admin/commands.ts
 M server/modules/integrations/google-drive/adapter.ts
 M server/modules/integrations/google-drive/provider.ts
 M server/worker.ts
 M shared/admin.ts
 M tests/portal.routes.test.ts
 M tests/proyectos.routes.test.ts
?? docs/arquitectura/42-portal-autor.md
?? docs/entregas/
?? docs/evidencias/portal-autor/
?? frontend/src/portalAutor/AuthorCredentials.tsx
?? frontend/src/portalAutor/AuthorPortalViews.tsx
?? frontend/src/portalAutor/AuthorWorkflowPanel.tsx
?? frontend/src/portalAutor/authorPortal.css
?? frontend/src/portalAutor/authorPortal.test.tsx
?? frontend/src/portalAutor/authorPortalApi.ts
?? scripts/author-portal-drive-smoke.ts
?? scripts/author-portal-qa-server.ts
?? scripts/author-portal-visual-qa.mjs
?? server/db/migrations/0097_quiet_luminals.sql
?? server/db/migrations/0098_groovy_golden_guardian.sql
?? server/db/migrations/0099_author_portal_integrity.sql
?? server/db/migrations/0100_fuzzy_centennial.sql
?? server/db/migrations/meta/0097_snapshot.json
?? server/db/migrations/meta/0098_snapshot.json
?? server/db/migrations/meta/0100_snapshot.json
?? server/db/schema/authorPortal.ts
?? server/helpers/authorAccounts.ts
?? server/helpers/authorDocuments.ts
?? server/helpers/authorFinalReview.ts
?? server/helpers/authorLegacyGuard.ts
?? server/helpers/authorMail.ts
?? server/helpers/authorPortal.ts
?? server/queue/authorPortal.worker.ts
?? server/routes/authorPortal.routes.ts
?? tests/authorPortal.test.ts
```

### Archivos nuevos

```text
docs/arquitectura/42-portal-autor.md
docs/entregas/portal-autor-2026-11-11.md
docs/evidencias/portal-autor/aprobacion-desktop.png
docs/evidencias/portal-autor/aprobacion-mobile.png
docs/evidencias/portal-autor/aprobacion-tablet.png
docs/evidencias/portal-autor/chiefSynchronized-desktop.png
docs/evidencias/portal-autor/confirmacion-desktop.png
docs/evidencias/portal-autor/confirmacion-mobile.png
docs/evidencias/portal-autor/confirmacion-tablet.png
docs/evidencias/portal-autor/decision-registrada-mobile.png
docs/evidencias/portal-autor/documentos-mobile.png
docs/evidencias/portal-autor/drive-smoke.json
docs/evidencias/portal-autor/especialista-desktop.png
docs/evidencias/portal-autor/final-preview.json
docs/evidencias/portal-autor/inicio-desktop.png
docs/evidencias/portal-autor/inicio-mobile.png
docs/evidencias/portal-autor/inicio-tablet.png
docs/evidencias/portal-autor/mis-proyectos-mobile.png
docs/evidencias/portal-autor/notificaciones-mobile.png
docs/evidencias/portal-autor/proyecto-desktop.png
docs/evidencias/portal-autor/proyecto-mobile.png
docs/evidencias/portal-autor/proyecto-tablet.png
docs/evidencias/portal-autor/report.json
docs/evidencias/portal-autor/revision-actual-desktop.png
docs/evidencias/portal-autor/revision-actual-mobile.png
docs/evidencias/portal-autor/solicitudes-mobile.png
docs/evidencias/portal-autor/specialistSynchronized-desktop.png
frontend/src/portalAutor/AuthorCredentials.tsx
frontend/src/portalAutor/AuthorPortalViews.tsx
frontend/src/portalAutor/AuthorWorkflowPanel.tsx
frontend/src/portalAutor/authorPortal.css
frontend/src/portalAutor/authorPortal.test.tsx
frontend/src/portalAutor/authorPortalApi.ts
scripts/author-portal-drive-smoke.ts
scripts/author-portal-qa-server.ts
scripts/author-portal-visual-qa.mjs
server/db/migrations/0097_quiet_luminals.sql
server/db/migrations/0098_groovy_golden_guardian.sql
server/db/migrations/0099_author_portal_integrity.sql
server/db/migrations/0100_fuzzy_centennial.sql
server/db/migrations/meta/0097_snapshot.json
server/db/migrations/meta/0098_snapshot.json
server/db/migrations/meta/0100_snapshot.json
server/db/schema/authorPortal.ts
server/helpers/authorAccounts.ts
server/helpers/authorDocuments.ts
server/helpers/authorFinalReview.ts
server/helpers/authorLegacyGuard.ts
server/helpers/authorMail.ts
server/helpers/authorPortal.ts
server/queue/authorPortal.worker.ts
server/routes/authorPortal.routes.ts
tests/authorPortal.test.ts
```
