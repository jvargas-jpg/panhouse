# Validadores · rediseño del rol y ciclo de revisión

Fecha: 12 de noviembre de 2026.

## Auditoría y decisión de dominio

El modelo anterior usaba `soporte_editorial` como bandeja compartida. `calidad.ts`, `soporteEditorialHome.ts`, `soporteEditorialWork.ts`, las rutas de Calidad y las rutas legacy de Ficha daban acceso al grupo, sin asignación individual. La interfaz ofrecía Inicio, Mi trabajo y Mis solicitudes; la revisión remitía a la Ficha completa. Diseño dependía de cuentas `disenador` y de un handoff del Especialista. Los archivos comentados se registraban pegando un enlace. Existían `project_assignments.tipo=validador`, versiones de Diseño, rondas canónicas, auditoría, notificaciones dirigidas, carpetas persistidas y un adaptador corporativo de Drive; se reutilizaron.

Se contrastaron las decisiones históricas de arquitectura 11/13/14, las auditorías 35/36, las plantillas/proyecciones de solicitudes, los gates de Autor y Paquete Final, el esquema y el manual local `fuentes-negocio/Proceso de adiestramiento - Especialista editorial (3).docx`, apartados 5.1–5.5 y revisión de colección. El manual pide versión diagramada + tripa original en Fase 1; versión anterior comentada + nueva versión en validaciones; números legales cuando corresponda en Revisión Final. Los enlaces y el contexto proceden de esos datos reales. El archivo disponible remite a una plantilla de correo, pero no incluye una plantilla independiente completa; no se inventaron campos a partir de esa referencia.

La nueva instrucción sustituye la antigua decisión de bandeja compartida. Se mantienen estas distinciones:

- **Validador/Validadores:** único rol de negocio y de API (`validador`). El enum persistido sigue siendo `soporte_editorial` por deuda temporal de compatibilidad; su traducción queda en `server/db/roleCompatibility.ts`. No existe una segunda clase de usuario ni un segundo enum de PostgreSQL.
- **Contexto del trabajo:** `CALIDAD | SOPORTE_EDITORIAL`. No son roles ni empleados adicionales.
- **Tipo del trabajo:** Validación Fase 1, Validación de aplicación de comentarios, Revisión Final, Validación Final y Revisión de cubierta. Los cuatro primeros pertenecen a Calidad; cubierta a Soporte Editorial. La precisión posterior del usuario confirma cubierta como trabajo asignable al mismo Validador. Sus aprobaciones creativas e internas siguen siendo independientes.
- Se conserva la escalación existente por colección inconsistente a Jefatura, disponible desde la revisión asignada.

## Migraciones y fuente de verdad

`0101_noisy_raider.sql` es aditiva: agrega solicitud de Validador, referencia del upload y clave de decisión a `ficha_calidad_fases`; IDs/revisiones Drive a `diseno_versiones`; proveedor externo a `disenos`; y outbox de avisos externos. Permite entregas externas sin fingir un usuario que las realizó. Desactiva las cuentas históricas de Diseño/Corrección y revoca sus sesiones, conservando personas y FKs. Copia nombre/email del diseñador histórico únicamente cuando ya existe esa relación.

`0102_big_dust.sql` permite reutilizar la misma outbox para feedback de Autor/Creativa sobre muestras y cubiertas. No se creó otra tabla de asignaciones, rondas, archivos binarios o estados del proyecto.

Las migraciones se verificaron en PostgreSQL 18.6 aislado: upgrade 0100→0102 con usuarios, sesiones, proveedor, versión V7 y una ronda histórica ya decidida. Se comprobaron conservación del resultado y de sus FKs, ausencia de asignaciones inferidas, backfill del proveedor y revocación exclusiva del acceso externo. No se aplicaron a la base de desarrollo inaccesible ni a producción. No se infirieron asignaciones desde el nombre del revisor histórico; las rondas pendientes requieren solicitud y asignación explícitas. Las versiones antiguas conservan su número y sus resultados.

La asignación vigente reside en `project_assignments`, tipo `validador`, scope `work_item_id`, con su índice único parcial y su historial. La ronda reside en `ficha_calidad_fases`; la versión exacta en `diseno_versiones`. El upload conserva file ID, revisión, nombre, folder key, hash y asignación vigente. El resultado guarda actor, fechas, archivo/version revisados, ronda, decisión y evento de auditoría.

## Auditoría posterior: rol, contexto y tipo de trabajo

La implementación inicial **no cumplía exactamente** la precisión: el login y `/auth/me` aún exponían el identificador técnico, y la bandeja solo agregaba rondas de Calidad. También quedaban notificaciones antiguas que presentaban Soporte Editorial como actor.

Se corrigió el contrato completo:

- `shared/roles.ts` define un único `validador`; frontend, RBAC, sesiones, formularios administrativos y lógica de dominio usan ese identificador. La API rechaza `soporte_editorial` como rol de entrada.
- `server/db/roleCompatibility.ts` traduce al entrar/salir de las columnas de usuarios y destinos de notificación, conservando los metadatos DDL originales de Drizzle. Las sesiones obtenidas por SQL crudo también se traducen. Los filtros/proyecciones SQL administrativos trabajan con el rol público; la serialización protege además respuestas e históricos JSON. No se reescriben auditorías ni cuentas históricas.
- El literal técnico solo permanece en ese adaptador, migraciones/snapshots inmutables, documentación histórica y verificaciones explícitas de compatibilidad. No aparece como valor de rol en los DTO públicos, componentes activos, navegación, labels ni notificaciones.
- `shared/validationWork.ts` separa `context`, `contextLabel`, `workType` y `workTypeLabel`. La UI compone `Calidad · Validación Fase 1`, `Soporte Editorial · Revisión de cubierta` y `Calidad · Revisión Final` desde esos datos, sin deducir otro rol.
- La bandeja única combina rondas de Calidad con `work_items.tipo=validacion_cubierta`. Ambos usan las mismas asignaciones individuales, solicitud del Especialista, asignación/reasignación de Jefatura, carga protegida y revisión por la persona asignada. La carga pendiente de candidatos suma ambos contextos. El Especialista ve `Validador asignado`.
- Cubierta usa un work item por versión y metadatos de validación en su campo existente `observaciones`; no se fabrican filas de Calidad para cubierta. Las nuevas entregas externas crean ese trabajo. Para una cubierta ya entregada, el Especialista dispone de una solicitud explícita e idempotente. No se asignan retrospectivamente usuarios a históricos.
- La siguiente cubierta conserva la asignación autorizada, tiene nueva carga/decisión y permite consultar los comentarios anteriores con su revisión Drive fijada. Reasignar invalida el acceso y el upload anterior. Devolver una cubierta cancela las revisiones todavía pendientes de esa versión; la siguiente entrega crea las revisiones creativas e internas correspondientes. Aprobar como Validador no aprueba por él a Creativa ni a Jefatura de Edición.

No se añadió ninguna migración para este ajuste. `0101` y `0102` siguen siendo las migraciones del rediseño previo. La deuda pendiente es eliminar en una futura migración deliberada el nombre histórico del enum y de destinos persistidos; **no representa semántica de negocio**. Las bases principales de desarrollo/producción no se modificaron en esta auditoría.

La verificación posterior pasó **18 pruebas** (12 de API/dominio y 6 de componentes). El escenario usa una sola sesión de Validador con tres proyectos: Fase 1, cubierta y Revisión Final; comprueba asignación de Jefatura, candidatos con carga combinada, aislamiento frente a otro Validador, reasignaciones, upload y ciclo de cubierta V0→V1, comentarios anteriores fijados en Drive y conservación de aprobaciones independientes. El contrato público prueba login, sesión, filtros de usuarios, catálogo de roles, sesiones administrativas, auditoría e históricos de notificación. Un último repaso ejecutó **7 pruebas** de cubierta y componentes tras reforzar el bloqueo de aprobación en V0; no se altera esa regla al cambiar de contexto.

Compilaciones de backend/frontend correctas y comprobación final de tipos del frontend correcta. La compilación frontend mantiene la advertencia de tamaño de chunks preexistente. Evidencia: `docs/evidencias/validadores/role-context-tests.txt`, `role-context-final-cover.txt`, `role-context-backend-build.txt`, `role-context-frontend-typecheck.txt` y el apartado `roleContextAudit` de `verification.json`. Drive y SMTP permanecen simulados en las pruebas; no se afirma una nueva verificación visual ni una ejecución contra servicios reales.

## Asignación, seguridad y concurrencia

El Especialista solicita; Jefatura asigna/reasigna con candidatos activos y carga pendiente real. La solicitud aparece en Jefatura y la notificación abre sus solicitudes. El Validador recibe un aviso dirigido; el Especialista conoce la persona asignada. Cada nueva versión mantiene la asignación que Jefatura autorizó para ese ciclo.

Todas las mutaciones se serializan mediante el mismo lock de proyecto que usa el workflow existente. La decisión exige la identidad de la asignación vigente y una clave idempotente. Cambiar la persona mientras otra revisión está abierta invalida al anterior. Un upload en curso vuelve a comprobar la asignación al terminar; si cambió, descarta exclusivamente el archivo recién creado. No sobrescribe una revisión anterior. Doble clic, reintento y dos cierres concurrentes no duplican decisiones.

El límite de sesión del Validador permite únicamente Validaciones, sus notificaciones y autenticación/salida. Bloquea las rutas antiguas de Ficha, proyectos, usuarios, Calidad y Diseño, además de cualquier mutación global. Los comandos comprueban nuevamente la asignación. Las respuestas de revisión no entregan información comercial, pagos, contratos, RRPP, carga del Especialista, work item IDs ni auditoría general.

Los archivos se abren mediante endpoints de material de la asignación. El cliente elige un tipo permitido, nunca un Drive file ID. La versión actual y las referencias disponibles se resuelven en servidor; las referencias de fuente deben pertenecer al workspace. Se sirven sin caché y con comprobación de acceso, sin dar al Validador permisos generales sobre carpetas de Drive. Los binarios de revisión admitidos son PDF y Word; las referencias nativas de Google Docs requieren una entrega documental compatible para conservar una revisión binaria.

## Drive y nomenclatura

Drive continúa siendo el almacén. PanHouse utiliza memoria temporal para validar y transferir; no guarda los binarios en la base ni en una nube propia.

- Comentarios: carpeta persistida `QUALITY_COMMENTS`.
- Entregas: carpeta persistida `DESIGN_REVIEW_VERSIONS`.
- Nombres de comentarios: `V<n>_F<fase>_R<ronda>_correcciones_a_aplicar_<uuid>.<extensión>`.
- Se normaliza la extensión, se valida tipo/contenido y tamaño (20 MB), se descarta el nombre original y se crea un archivo nuevo. La UUID evita colisiones. El nombre previsto aparece junto al dropzone.
- Las revisiones binarias se conservan en Drive. Los registros guardan su file ID y revisión exacta.
- El detector periódico del worker acepta únicamente un archivo pertinente: carpeta de proyecto, proceso, proveedor, versión esperada, fecha de entrega posterior al pedido/feedback, MIME/tamaño válidos e ID todavía no registrado. Una entrega ambigua no se elige arbitrariamente. Renombrados y cambios de metadatos de archivos ya recibidos no crean rondas.
- Diagramación usa `V0.pdf`, `V1.pdf`…; muestras y cubiertas se diferencian mediante `Muestra_V0.pdf` y `Cubierta_V0.pdf`. Los gates creativos/internos de cubierta se conservan.

El scope histórico `drive.file` no descubre todos los archivos creados por un proveedor desde Drive. Para las entregas externas se admite configurar `https://www.googleapis.com/auth/drive`, con reconexión OAuth explícita de la cuenta corporativa. No se amplió una conexión real durante esta implementación. La configuración verifica el scope solicitado y sigue rechazando scopes desconocidos y redirects inseguros. Referencia: [permisos oficiales de Google Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## Rondas y devolución del control

V0 y cualquier primera revisión sin comentarios previos aplicables muestran el cierre positivo deshabilitado. Enviar cambios requiere un upload válido y confirmado. La decisión cierra esa revisión, registra comentarios y deja Diseño esperando una nueva entrega. El aviso externo queda en la outbox dentro de la misma transacción.

La recepción pertinente de Drive crea una nueva versión y una nueva ronda, reactiva el trabajo asignado y avisa al Validador. Los números de ronda conservan el alcance por fase del modelo existente (F1.1, F2.1, F2.2…); no se reinterpretaron como un contador universal.

Las versiones posteriores permiten confirmar `todos_aplicados` sin subir otro archivo, tras confirmación explícita. La primera revisión de Revisión Final no reutiliza comentarios de un proceso anterior para saltarse su ciclo. El cierre positivo devuelve el control al Especialista: Calidad inicial permite continuar hacia Autor; Revisión Final satisface su gate de tripa y conserva la comprobación independiente de cubierta para Paquete Final. No se mueve automáticamente el proceso global.

Los avisos externos se envían automáticamente por SMTP, con reintentos persistidos y Message-ID estable. SMTP ofrece entrega al menos una vez; no se promete exactamente una vez frente a una caída después de enviar. No se enviaron mensajes reales durante QA. El proveedor debe disponer de los permisos correspondientes en su carpeta de Drive; esta implementación no cambia permisos corporativos de forma implícita.

## Interfaz y Command Center

El Validador tiene una única entrada: **Validaciones**. Las rutas anteriores de Inicio/Mi trabajo/Mis solicitudes desembocan en la misma experiencia; el acceso al proyecto redirige a ella. No tiene módulo de historial. La bandeja muestra solo trabajo pendiente asignado, archivos, versión, contexto útil, dropzone y decisiones. Al enviar comentarios o terminar, el trabajo sale de pendientes hasta que una nueva entrega requiera acción.

Se conserva el shell canónico (navy/blanco/dorado/sans), con layout de bandeja y revisión y adaptación por breakpoints. La confirmación utiliza el Dialog del design system.

El Especialista ve solicitud/asignación, Validador actual, ronda, versión y quién tiene la pelota. El selector de procesos usa la misma proyección: una revisión con comentarios no presenta Calidad como terminada. La pestaña de actividad incorpora un timeline cronológico completo de intercambios, nacido de asignaciones, uploads, entregas Drive, inicio y decisiones reales. El historial general también reconoce los nuevos eventos. No se redacta el timeline manualmente.

Las notificaciones del Validador están acotadas a su asignación vigente y accionable. Se excluyen broadcasts históricos, avisos de uploads, renombrados y actividad administrativa.

## Verificación y límites de entrega

Resultados: 73/73 pruebas focalizadas de dominio/UI/Drive/carpetas; después del ajuste final de la proyección del Command Center, 10/10 pruebas de dominio nuevamente aprobadas. Se validó además el upgrade histórico 0100→0102. Los comandos y salidas se conservan en [pruebas focalizadas](../evidencias/validadores/tests.txt), [dominio final](../evidencias/validadores/domain-final.txt), [migración histórica](../evidencias/validadores/migration-qa.txt), [QA HTTP](../evidencias/validadores/http-qa.txt), [build backend](../evidencias/validadores/backend-build.txt) y [build frontend](../evidencias/validadores/frontend-build.txt). Las compilaciones de backend y frontend terminaron con exit 0; el frontend mantiene una advertencia de tamaño de chunks. La prueba HTTP utiliza la API y PostgreSQL reales con adaptadores simulados para Drive/SMTP. Recorre Calidad V0→V1→V2 y Revisión Final V2→V3→V4, con una devolución adicional antes de cada cierre. No equivale a una prueba contra la cuenta corporativa de Google.

Para repetirla: iniciar `scripts/validadores-qa-server.ts` con `DATABASE_URL` apuntando a una base local desechable cuyo nombre termine en `_validation_preview`, después ejecutar `node scripts/validadores-qa-check.mjs`. El harness rechaza bases de otro nombre/origen y no inicia workers ni envía mensajes reales. Las identidades son exclusivamente fixtures. El frontend de preview usa puerto 5176 y proxy a 3015. Los servicios aislados utilizados durante esta sesión se detuvieron al terminar. [Resumen verificable](../evidencias/validadores/verification.json).

La revisión visual mediante Computer Use quedó bloqueada: el host de navegador no estaba disponible y la herramienta no pudo verificar la URL de Chrome. No se afirma QA visual desktop/mobile completada. Antes de la puesta en marcha real faltan aplicar las migraciones al entorno objetivo, reconectar Drive con el scope necesario, configurar SMTP y verificar permisos/entrega del proveedor y apariencia en navegador. Las suites antiguas que describen la bandeja compartida y cuentas operativas externas corresponden a la política sustituida; no se reporta la suite completa del repositorio como aprobada.

## Archivos y estado Git

El listado completo de archivos modificados y nuevos está en [git status](../evidencias/validadores/git-status.txt). [git diff --stat](../evidencias/validadores/git-diff-stat.txt) contiene la salida literal del comando; Git no incluye archivos nuevos sin staging en esa estadística, por lo que [archivos nuevos](../evidencias/validadores/archivos-nuevos.txt) los enumera aparte. No se creó commit ni se hizo staging.
