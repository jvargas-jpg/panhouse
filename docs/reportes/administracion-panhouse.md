# Administración PanHouse — implementación y verificación

Fechas de implementación y verificación: 28–29 de octubre de 2026. Repositorio: `panhouse`. Alcance: especificación Administración / Superadmin adjunta por el usuario, conservando los cambios anteriores de Soporte Digital y las experiencias de los demás roles.

**Estado de entrega:** implementación técnica y validación automatizada completadas: **2.054 pruebas aprobadas en 120 archivos, sin casos fallidos ni omitidos en el resultado consolidado**. La aceptación visual está pendiente. No se declara cumplida la definición de terminado de la especificación mientras falte el QA de navegador en los tres tamaños pedidos.

## Evidencia y límites de la verificación

- Arquitectura: [39-administracion.md](../arquitectura/39-administracion.md).
- Backend: `server/modules/admin/{routes,policy,projects,queries,commands,integrations,health}.ts`.
- Frontend: `frontend/src/admin/`, acceso desde `/admin/inicio` para el rol `admin`.
- Pruebas nuevas: `tests/admin.test.ts` y `frontend/src/admin/admin.test.tsx`.
- Migraciones nuevas: `0094_admin_role.sql` y `0095_administracion.sql`, posteriores a la migración de solicitudes digitales `0093`.
- No se realizaron commits, cambios de Docker, restablecimientos de contraseña ni modificaciones de `.env`.
- Existe un archivo local de credenciales en `secrets/panhouse-system-admin.local.json`, excluido de Git. Se utilizó internamente para el smoke HTTP; su contenido y el token de sesión no se imprimieron. No se promovió ni se restableció ninguna cuenta existente.
- El smoke local verificó login administrativo, 11 consultas administrativas y las 9 rutas frontend con HTTP 200. PostgreSQL y Redis respondieron; el endpoint de salud informó migraciones al día. El smoke cerró su sesión al terminar. Estas comprobaciones HTTP no sustituyen el QA visual ni una prueba E2E de clics.
- Computer Use informó que el host del navegador no estaba disponible y detuvo el control de Chrome porque no pudo determinar su URL con confianza. Se detuvieron las acciones de navegador. No hay capturas ni aprobación visual. No se utilizó otra vía de automatización para eludir el bloqueo.
- Se encontraron y detuvieron corridas anteriores de Vitest que compartían la base de pruebas. El usuario confirmó que había detenido Claude. Esas corridas concurrentes se descartaron. Una corrida posterior limpia completó las 158 pruebas de `trazabilidad.routes.test.ts`; ese archivo conserva su aprobación explícita. Para reducir la espera, las otras 119 suites se repartieron entre dos bases temporales independientes, manteniendo ejecución serial dentro de cada base. No se cuentan archivos interrumpidos ni se duplican los 158 casos ya aprobados.

## Reporte obligatorio A–CR

| Punto | Resultado y evidencia |
| --- | --- |
| A. Estado inicial del Admin | No existía un rol administrativo separado. Dirección tenía funciones comerciales e integración con Drive, sin centro administrativo global ni gestión real de sesiones desde la interfaz. Había cambios locales anteriores de Soporte Digital que se conservaron. |
| B. Roles encontrados | Se conserva el catálogo canónico `ROLES`: Dirección, Comercial, RRPP, Jefaturas, Especialista, Editor, Corrector, Líder Creativo, Diseñador, Soportes, Impresión, Distribución, Cobranzas, Talento Humano y Autor. Se añade `admin`; no se renombra Dirección ni se le concede administración de forma implícita. |
| C. Estrategia Admin/Dirección | Administración es un rol explícito con políticas centrales; Dirección conserva su experiencia y sus guards. El nombre o una cabecera enviada por el cliente no concede privilegios. |
| D. Arquitectura final | Módulo Fastify bajo `/api/admin`, proyecciones SQL de consulta y comandos de dominio separados. Frontend con shell propio y carga diferida. Se reutilizan Ficha viva, asignaciones históricas, integración Drive y outbox documental existentes. |
| E. Rutas creadas | UI: Inicio, Pipeline, Proyectos y detalle, Personas, Actividad, Solicitudes, Integraciones, Configuración y Salud. API: policy, inicio, pipeline, proyectos, work-items, equipo, ficha, workspace/files, usuarios, asignaciones, colaboradores, sesiones, actividad, solicitudes/evidencia, integraciones, workspaces, configuración, salud y búsqueda. Los POST son acciones concretas de dominio; no hay PATCH de tablas. |
| F. Shell Admin | Navegación azul institucional, acento dorado, logo oficial, encabezado, identidad y notificaciones existentes, contenido con estados de consulta propios. CSS acotado al centro administrativo. |
| G. Navegación | Nueve entradas persistentes, sección activa, búsqueda global tipada, menú móvil y enlaces contextuales entre proyecto, tarea, persona, solicitud y auditoría. No hay enlaces `href="#"`. |
| H. Inicio | Presenta intervención prioritaria con proyecto, responsable y causa; actividad reciente y diagnóstico secundario independientes. Sin proyectos inventados cuando no hay datos. |
| I. KPIs | Proyectos activos, atención, bloqueo y vencimiento proceden de la misma proyección que Pipeline/360. La actividad de usuarios usa peticiones autenticadas de los últimos 15 minutos y se explica su significado. Cargando se muestra una raya, no cero inventado. |
| J. Intervención | Inicio identifica causas y lleva al contexto. Las acciones sensibles usan confirmación, impacto, motivo, versión y clave de idempotencia. No se ofrece una edición libre de estado. |
| K. Actividad | Feed humano de hechos de negocio con actor, fecha y enlaces a proyecto o detalle técnico. La selección abre un panel de consulta, sin acciones para editar el evento. |
| L. Resumen de salud | PostgreSQL, Redis y colas con fecha de consulta. Drive se distingue como integración que requiere su propia verificación. Un fallo del resumen no elimina los proyectos del Inicio. |
| M. Arquitectura Pipeline | Proyección `PROJECT_FACTS` central para Inicio, Pipeline, filtros y Project 360. Procesos en columnas; los trabajos simultáneos se conservan como entidades individuales. |
| N. Modelo de datos Pipeline | Usa `work_items`, pasos/fases, asignaciones canónicas, capítulos, correcciones, diseños, Calidad, bloqueos y snapshots documentales existentes. No añade un estado general ficticio que sustituya el modelo operativo. |
| O. Work items paralelos | Un proyecto puede mostrar varios procesos activos y varias tareas de un mismo proceso. Se mantiene su responsable, plazo, espera, gate, estado y fecha. No se transforma en una secuencia porcentual. |
| P. Filtros Pipeline | Búsqueda literal, servicio, estado, Especialista, área, Express vigente, bloqueo, vencimiento, espera, falta de responsable e inconsistencia. Filtrado, conteo y paginación se ejecutan en SQL. |
| Q. Detalle Pipeline | Panel de tarea con contexto del proyecto, asignación, responsable, plazo, espera, gate y otras tareas del mismo proceso. Reapertura solo si el dominio admite el caso seguro implementado. |
| R. Project 360 | Lectura administrativa global de cada proyecto, independiente de asignaciones del usuario. Integra equipo, trabajo paralelo, ficha, documentos, solicitudes y trazabilidad. |
| S. Tabs de proyecto | Resumen, Procesos, Equipo, Ficha, Archivos, Solicitudes, Actividad y Auditoría. Tab y regreso a filtros de Pipeline/Proyectos se conservan en URL. |
| T. Equipo y asignaciones | Historial canónico con vigencia, actor y motivo de cierre. Las referencias antiguas de Especialista, Editor y Diseñador se muestran explícitamente sin fecha inventada y cuentan como responsabilidades existentes. La reasignación crea historia canónica desde el momento real de la intervención y conserva el responsable anterior en audit. Una referencia contradictoria se puede alinear con el responsable canónico sin cerrar ni crear otra asignación. El servidor determina si cada fila admite reasignación; entregas y contratos protegidos no ofrecen una acción inaplicable. Calidad y Soporte Digital conservan sus bandejas compartidas por rol. |
| U. Ficha | Reutiliza `resumenFichaViva` y `expedienteFichaViva` con acceso administrativo de lectura. No clona un formulario ni amplía permisos de escritura de campos. Las credenciales de Amazon quedan fuera. |
| V. Archivos | Diagnóstico del workspace persistido y archivos de carpetas canónicas autorizadas por proyecto/clave. Se valida contexto de integración, raíz y parentesco antes de consultar Google. El navegador no envía un folderId arbitrario. |
| W. Solicitudes por proyecto | Misma consulta global filtrada por proyecto, con familia, solicitante, destino, tarea, versión y bloqueo. Preserva los ciclos operativos propios de cada familia. |
| X. Actividad por proyecto | Feed paginado y contextual con actor y fecha, desde los registros reales existentes. |
| Y. Auditoría por proyecto | Vista técnica filtrada con antes/después, motivo, identidad y enlaces a entidades. No hay edición ni borrado de auditoría por API. |
| Z. Usuarios | Alta explícita, búsqueda, tipo interno/externo, activación/desactivación y cambio de rol. El alta de Autor exige seleccionar un registro canónico existente por búsqueda, conserva el vínculo en auditoría y lo muestra en el detalle; no crea otra ficha. Contraseña inicial con hash; no se devuelve. Desactivar o cambiar rol revoca sesiones y conserva asignaciones e historia. Se protege el último administrador activo. |
| AA. Usuarios externos | Cuenta persistente de Corrector externo, reutilizable entre proyectos. Las referencias históricas de colaboradores sin cuenta se muestran separadamente; no se convierten automáticamente en cuentas ni identidades de acceso. |
| AB. Roles | Política central `hasAdminPermission` y guards de servidor. Matriz administrativa de consulta. No se inventa un editor de permisos dinámicos que las rutas existentes no aplicarían. |
| AC. Sesiones | Login, última actividad, expiración, IP/user agent, revocación y view-as persistidos. ID público UUID separado del hash de la cookie. Revocación real, incluso de la sesión actual, con salida de la UI cuando corresponde. |
| AD. Presencia | Última actividad significa una petición autenticada. La actualización se limita a una por minuto. Se diferencia una sesión vigente de un usuario actualmente presente; no se muestra “online”. |
| AE. Invitaciones | El sistema no tiene lifecycle ni envío de invitaciones. Se muestra esa limitación y se ofrece alta administrativa real. No se añadió un botón que simule enviar correo. |
| AF. View-as | Selección de cuenta activa no administradora con motivo. La sesión conserva administrador real y usuario efectivo. Banner persistente de solo lectura y salida explícita con limpieza del caché de identidad. |
| AG. Seguridad de impersonación | Ámbito y permisos corresponden al usuario efectivo. Escrituras bloqueadas centralmente en rutas nuevas y existentes; solo se permite salir del modo o cerrar sesión. El callback OAuth GET también se bloquea por su efecto de escritura. No se aceptan cabeceras de impersonación. Se auditan entrada y salida con la identidad administrativa real. |
| AH. Actividad de auditoría | Feed de negocio separado de la tabla técnica, ambos basados en eventos reales. Filtros de persona, rol actual del actor, proyecto, acción, entidad y fechas. El filtro de persona incluye los cambios administrativos que afectaron su cuenta o su responsabilidad anterior; seguridad incluye la cuenta destinataria del evento. Las reasignaciones nuevas guardan nombres y referencias anteriores, no solo UUID. |
| AI. Auditoría técnica | Detalle con diferencias antes/después y metadatos depurados. Paginación SQL y enlace directo desde entidades. No se envían registros raw completos con credenciales. |
| AJ. Seguridad | Eventos de login correcto/fallido, logout, creación/activación/desactivación de cuenta, cambio de rol, revocación y view-as. Los intentos fallidos no guardan contraseña ni un correo desconocido como identidad autenticada. |
| AK. Overrides | Vista específica de acciones `ADMIN_*`, con actor, razón y resultado. Reutilización de la clave de confirmación devuelve el resultado ya registrado sin duplicar efectos. |
| AL. Solicitudes globales | Unifica solicitudes de área, decisiones y contratos de Corrección sin cambiar sus estados canónicos. Filtros, detalles, preguntas/evidencia/historia cuando existen. Solo se implementan cancelación administrativa segura de solicitud de área y reparación de destino hacia el Especialista actual. |
| AM. Incidencias técnicas | Workspaces con error y fallos retenidos de BullMQ. Enlaces al contexto documental cuando existe un proyecto. No se crea una bandeja de errores ficticios ni se borra un fallo con una acción genérica. |
| AN. Integraciones | Estado corporativo de Drive y sus espacios. Pago/SSO y email se identifican como sin monitor de proveedor cuando no existe uno. No se confunde una configuración local con una conexión verificada. |
| AO. Google Drive | Reutiliza el servicio OAuth y los scopes existentes. Conectar, desconectar y verificar tienen motivo e idempotencia administrativa. Dirección conserva sus rutas; Admin usa las rutas auditadas. Ningún token se expone al frontend. |
| AP. Diagnóstico Drive | Estado guardado, códigos seguros, fecha de verificación, plantilla, asociaciones y contexto. La prueba explícita del proveedor se distingue del diagnóstico persistido. La lista de archivos valida proyecto, integración, contexto de almacenamiento y padre. |
| AQ. Reparación Drive | Reutiliza `project_workspace_requests` y el dispatch existente después del commit. No genera nuevas raíces por reintento ni borra/mueve carpetas. Si la operación externa falla, no se informa un éxito distribuido ficticio. |
| AR. Arquitectura de configuración | Consulta de los catálogos y constantes vigentes. Edición limitada a disponibilidad de servicio para altas futuras. Se explica qué reglas no se pueden modificar sin versionado por proyecto. |
| AS. Servicios | Catálogo real con código, complejidad, plazos y disponibilidad. Activar/desactivar exige motivo y estado esperado. El alta canónica de proyecto verifica disponibilidad y bloquea la fila compartida dentro de su transacción; proyectos existentes se conservan. |
| AT. Fases | Catálogo y relaciones servicio/fase existentes, en lectura. No se cambia el orden de proyectos activos. |
| AU. Pasos | Pasos canónicos con fase, orden y vigencia. Lectura protegida; sin botones para mutar un proceso que no dispone de versiones. |
| AV. SLA | Constantes de dominio existentes para Edición, respuesta de Autor y Corrección. El cálculo SQL de Edición replica la extensión por pausas superpuestas; se prueba su equivalencia. Esperas y pausas no se presentan como retraso imputable al Editor. |
| AW. Gates | Catálogo explicativo vinculado a condiciones reales, incluidos título, aprobación interna, revisión previa y momento de reunión creativa. Se conserva el bloqueo de cada work item y su fuente. |
| AX. Tipos de solicitudes | Se consultan las restricciones reales y familias de negocio. No se añaden tipos que los consumidores operativos no entiendan. |
| AY. Notificaciones | Se documentan disparadores, destinatarios y evidencia de eventos existentes. No hay un editor de reglas ficticio; avisos de reasignación y acceso se crean en la transacción del comando correspondiente. |
| AZ. Plantillas Drive | Resolver canónico con clave, versión y folderKeys por servicio. Sin una segunda estructura editable incompatible con el provisioning actual. |
| BA. Seguridad del versionado | No hay snapshot por proyecto de fases, pasos y plazos: esa configuración queda en lectura. No se altera retroactivamente la operación activa. La disponibilidad del servicio tiene efecto únicamente sobre nuevas altas. |
| BB. Salud | Probes independientes con fecha: aplicación, Postgres, Redis, colas y migraciones. Los fallos parciales se representan como no disponible, no como salud confirmada. |
| BC. Postgres | `SELECT 1`, latencia y métricas del pool actual. La información corresponde al proceso que atiende la consulta, no a toda la infraestructura. |
| BD. Redis | PING con conexión dedicada y tiempo acotado. Error de conexión se informa sin devolver URL ni credenciales. |
| BE. BullMQ | Conteos reales de las colas existentes `project-drive-workspaces` y `notificaciones`, con cierre de recursos de consulta. No se infiere la presencia de un worker desde un conteo vacío. |
| BF. Jobs | Hasta 20 fallos retenidos por cola, con identificador, nombre, intentos, fecha y proyecto válido. No se envían `job.data`, stack ni failedReason sin depurar. No se implementa un retry genérico de jobs. |
| BG. Errores | Errores de API administrativos son contextuales y sin secretos. La UI ofrece reintento por sección. No existe un almacén histórico central de errores de aplicación; se declaran solo las fuentes de error disponibles. |
| BH. Migraciones | Compara journal con migraciones aplicadas en la base. No se ofrece ejecución de migraciones desde el navegador. Si no se puede consultar el journal o la base, se informa no disponible. |
| BI. Backups | Estado explícito `not_monitored`: no hay evidencia de última copia ni restauración. No se fabrica una fecha ni una confirmación de respaldo. |
| BJ. Acciones de dominio | Alta/acceso de cuenta, revocación, reasignación, reparación de una referencia de responsable contradictoria, reapertura editorial segura, cancelación/reparación de destino, disponibilidad de servicio, reparación documental, integración y view-as. No se implementa “guardar cualquier campo”. |
| BK. Motivo | Obligatorio, entre 10 y 2000 caracteres, validado en API y comando. Confirmación muestra impacto antes de enviar. Motivo y actor se incluyen en auditoría. |
| BL. Transacciones | Cambios de DB, historial, audit, notificaciones y ledger de idempotencia se confirman juntos. Ninguna llamada de red externa se ejecuta bajo el lock transaccional administrativo. Integraciones documentan inicio y desenlace de forma separada. |
| BM. Concurrencia | Lock de comandos, bloqueos de filas, versiones esperadas y comparación de asignación/responsable actual. Un contexto stale responde conflicto; el cliente pide revisar el contexto actualizado. La protección de último admin se realiza bajo el mismo lock. |
| BN. Idempotencia | UUID de confirmación por actor, acción y fingerprint del propósito público; índice único persistido. La contraseña inicial se excluye del digest para no crear un verificador rápido. Repetir un alta con la misma clave no modifica la credencial original. Un mismo key con otro propósito se rechaza. No duplica historial, notificaciones ni outbox. En OAuth no se persiste la URL con state en el ledger. |
| BO. RBAC | Todas las rutas administrativas verifican sesión activa y rol administrativo en servidor. Los comandos revalidan el permiso en DB. Usuarios normales y Dirección reciben 403; una cookie inexistente o revocada recibe 401. |
| BP. IDOR | Acceso global solo para Admin. El view-as vuelve al ámbito del usuario efectivo. Evidencias comprueban solicitud/archivo/tarea/proyecto; Drive solo admite claves de carpetas registradas y contexto corporativo vigente. |
| BQ. Secretos | Selecciones explícitas de usuarios y sesiones, sin hash de cookie ni password. Redacción recursiva de audit incluyendo campos estructurados, parámetros secretos en URL y marcadores de credenciales. Ficha no incluye cuenta Amazon. No se leyeron `.env` ni secretos para mostrarlos en informes. |
| BR. Inmutabilidad de auditoría | No existen endpoints de modificación o borrado de audit ni controles UI para hacerlo. La cuenta de DB de la aplicación conserva sus permisos actuales: esto no constituye una garantía WORM contra un operador directo de Postgres; esa separación de privilegios sigue siendo una mejora de infraestructura. |
| BS. Paginación | SQL para proyectos, pipeline, usuarios, sesiones, asignaciones, solicitudes, auditoría y workspaces; tamaños 10/25/50 acotados. Drive usa pageToken del proveedor. El detalle de solicitud limita preguntas, historial y evidencia a 100; la auditoría completa tiene enlace paginado. |
| BT. N+1 | Proyectos y trabajos se obtienen en proyección agregada, sin consulta por celda ni llamadas Drive por fila. La prueba de Pipeline de 30 proyectos controla un máximo constante de consultas. Una consulta lateral SQL por entidad no implica un roundtrip por fila. Falta EXPLAIN/medición con volumen de producción. |
| BU. Índices | Unicidad de operación por actor/key, identificador público y actividad de sesiones, eventos de seguridad, audit por fecha, work items por proyecto/plazo y asignaciones activas por proyecto. Índices y funciones SQL están en `0095`. |
| BV. Estado URL | Filtros, paginación, tabs y entidades seleccionadas de las pantallas principales en query params. Cambio de carpeta limpia pageToken atómicamente. La vuelta de 360 conserva la búsqueda/listado original. Algunos subpaneles internos de persona usan estado local. |
| BW. TanStack Query | Prefijo de caché administrativo con identidad y endpoint; placeholder solo del mismo usuario/recurso. StaleTime de 15 segundos, retry acotado e invalidación tras comandos. Login/logout/view-as limpian cachés para impedir mezcla de ámbitos. |
| BX. Accesibilidad | Controles con nombre, estados status/alert, foco visible, diálogo nativo modal con Escape y restitución de foco, confirmación deshabilitada mientras envía y soporte de movimiento reducido. La comprobación con lector de pantalla y teclado real sigue pendiente del navegador. |
| BY. Responsive | CSS con navegación móvil, tablas convertidas a lectura por campo donde corresponde, paneles adaptables y scroll horizontal contenido para el Pipeline. La implementación responsive no equivale a una aprobación visual en dispositivos. |
| BZ. QA 1440 | **Pendiente.** Computer Use detuvo el acceso por no poder verificar la URL de Chrome. No se produjo captura ni validación visual 1440×900. |
| CA. QA 768 | **Pendiente.** No se verificó 768×1024 en navegador. No se afirma ausencia de overflow ni calidad visual comprobada. |
| CB. QA 375 | **Pendiente.** No se verificó 375×812 en navegador. Menú, cards, overlays y teclado requieren revisión real. |
| CC. Hallazgos visuales | No hay hallazgos de una inspección visual que no se pudo realizar. La revisión estática detectó acciones sobre asignaciones históricas, transición de identidad y pérdida de pageToken; se corrigieron en código. |
| CD. Correcciones tras QA visual | Ninguna se atribuye a QA visual. Las correcciones mencionadas provienen de lectura de código y pruebas automatizadas. Se requiere abrir todas las pantallas, corregir hallazgos y repetir antes de aceptación visual. |
| CE. Pruebas backend | **41/41 aprobadas** en `tests/admin.test.ts`: permisos, scope, paralelismo, consistencia de métricas, SLA, paginación, usuarios/sesiones, view-as, transacciones, conflicto, idempotencia, solicitudes, secretos, configuración, Drive y salud. Incluye las referencias legacy y su reparación, el alta de Autor y el reloj de sesión. |
| CF. Pruebas frontend | **23/23 aprobadas** en `frontend/src/admin/admin.test.tsx`: SSR de las nueve secciones y estados cargados/error/vacío, pipeline paralelo, 360, histórico/referencias, sesiones, alta vinculada de Autor, confirmación y enlaces seguros. No sustituyen eventos reales de navegador ni medición de layout. |
| CG. Regresión | Cobertura verificada de los 120 archivos. Trazabilidad completó 158 casos; los otros archivos se repartieron en dos bases temporales independientes. Después se sustituyeron los dos archivos administrativos por su última ejecución completa (64 casos) y Project Command Center por su repetición aislada (18/18), que resolvió los rechazos de sesión de la ejecución previa. Las corridas concurrentes anteriores quedan excluidas. La tabla final conserva los resultados originales y sus correcciones. |
| CH. Total de pruebas | **2.054 aprobadas, 0 fallidas, 0 omitidas, 120 archivos únicos.** Se validó que el conjunto consolidado coincide exactamente con los archivos de prueba del repositorio. Cada archivo usa su última ejecución aprobada; los reintentos no se suman dos veces. |
| CI. Typecheck | Se verifica backend y el frontend mediante `tsc -b` del build. Evidencia definitiva al final. |
| CJ. Builds | Backend TypeScript y frontend Vite. Admin se carga como chunk diferido; el warning de tamaño del bundle general se conserva como observación y no se oculta. Evidencia definitiva al final. |
| CK. Migraciones | `0094` añade enum `admin`; `0095` añade tipo de cuenta, metadatos/revocación/view-as de sesiones, seguridad, operaciones e índices/funciones. Aplicadas en desarrollo y en la base aislada de pruebas; smoke de salud informó `up_to_date`. No se ejecutó un reset de DB. |
| CL. Archivos cambiados | Módulos nuevos y puntos de integración enumerados arriba y en el documento de arquitectura. La instantánea final de Git se incluye al final, distinguiendo los cambios previos de Soporte Digital que ya estaban presentes. |
| CM. `git diff --stat` | Instantánea al final. Git solo incluye los archivos tracked en este comando; los módulos nuevos se enumeran mediante status y el inventario, no se ocultan por esa limitación. |
| CN. `git status` | Instantánea al final. El trabajo permanece local y sin commit/staging automático. El script previo de reset de Soporte Digital no fue ejecutado ni modificado. |
| CO. Gaps conocidos | QA visual/E2E pendiente; invitaciones, monitor de backups y almacén central de errores no existen; configuración de workflows carece de versionado; evidencias de detalle tienen límite 100; jobs retenidos limitados a 20 por cola; los roles del actor se consultan desde su cuenta actual, pues el audit previo no conserva una foto de ese rol; falta carga representativa y comprobación con tecnologías asistivas. |
| CP. Deliberadamente no implementado | Editor raw de DB, borrado de historia, mutación genérica de estado, force-complete, bypass de gates, reapertura indiscriminada, retry genérico de jobs, cambio retroactivo de SLA/fases, usuarios externos automáticos desde nombres históricos, reglas de email ficticias ni health/presencia simulados. La reapertura expuesta se limita al cierre editorial sin entregas, capítulos ni procesos posteriores que lo hagan inseguro. Las primeras asignaciones y las tareas de Corrector sin historial canónico o con contrato externo siguen requiriendo su flujo de área. |
| CQ. Riesgos descubiertos | Dirección no era Admin; sesiones no disponían de revocación/historial para gestión administrativa; view-as requería un guard global incluidas rutas antiguas y callbacks GET; audit histórico podía contener metadatos sensibles; editar catálogos sin snapshots afectaría proyectos activos. Se separaron roles, persistió revocación, bloqueó view-as, depuraron lecturas y protegió configuración. Persisten los límites de permisos DB, retención de IP/UA y fuentes sin monitor descritos arriba. |
| CR. Antes del E2E del pipeline | Completar QA visual en los tres tamaños; usar cuentas de prueba de cada rol y Drive de pruebas; recorrer paralelismo, reasignaciones, esperas, bloqueos y reapertura permitida; probar sesión revocada y view-as con dos navegadores; comprobar desconexión/provisioning fallido sin duplicar carpetas; acordar política de retención y backup/restauración; medir consultas con volumen real. No usar una cuenta de Autor ni datos reales para una prueba destructiva. |

## Resultados finales de comandos

Las comprobaciones finales de TypeScript backend, build backend y build frontend terminaron con código 0. Vite advierte sobre el tamaño del bundle general; el centro administrativo tiene chunk diferido propio. `git diff --check` no encontró errores de whitespace.

Verificación final del módulo administrativo: **64/64 pruebas aprobadas** en `admin-final.result.json`: 41 de backend y 23 de interfaz SSR, sin casos omitidos. Incluye el ajuste del reloj de sesión, cuentas de Autor, responsables legacy y reparación auditada de referencias. Las ejecuciones parciales anteriores se sustituyen por este resultado al consolidar el total; no se suman como pruebas adicionales.

La consolidación se verificó contra los 120 archivos de pruebas detectados en el repositorio. El resumen local está en `secrets/admin-validation-summary.local.json`, con el origen del resultado de cada archivo. Los reportes y logs de verificación permanecen excluidos de Git.

| Comprobación | Resultado |
| --- | --- |
| Backend `npm run typecheck` | Código 0. |
| Backend `npm run build` | Código 0. |
| Frontend `npm run build` (`tsc -b` y Vite) | Código 0; warning de tamaño del bundle general. |
| Administración, repetición final completa | 41 backend + 23 SSR = 64/64, código 0. |
| Archivo de Trazabilidad finalizado en la corrida limpia inicial | 158/158. Se conservó el resultado del archivo antes de repartir los demás; la corrida inicial no se presenta como un comando completo aprobado. |
| Grupo A de regresión | 59 archivos, 965/965, código 0. |
| Grupo B de regresión, resultado original | 60 archivos, 912 aprobadas y 15 fallidas en Project Command Center, código 1. Este resultado se conserva como evidencia histórica y no se declara aprobado. |
| Project Command Center, repetición aislada con código actual | 18/18, código 0. Sustituye el resultado anterior de ese archivo. |
| Resultado consolidado, sin duplicados | **120 archivos; 2.054/2.054; 0 fallidas; 0 omitidas.** |
| Smoke HTTP final | Login, once endpoints administrativos y logout respondieron correctamente. Las nueve rutas frontend también habían respondido HTTP 200; su render y sus estados están cubiertos por SSR. |
| Limpieza de infraestructura de prueba | Las dos bases temporales fueron eliminadas tras cerrar sus procesos y comprobar que no tenían conexiones. Se conservaron la base de desarrollo, la base de pruebas original y las credenciales locales. |

Los 15 fallos originales de Project Command Center eran respuestas 401 en pruebas con fecha de negocio simulada. La ejecución larga había comenzado antes de unificar el reloj de emisión y validación de sesiones con PostgreSQL. La repetición independiente con el código actual pasó las 18 aserciones originales; la suite administrativa comprobó además que una sesión realmente expirada sigue recibiendo 401. No quedaron errores no gestionados en los logs de los grupos.

La validación automatizada no equivale a QA visual ni a una ejecución E2E de clics en navegador. Las secciones BZ–CD permanecen pendientes por el bloqueo de Computer Use.

## Instantánea final de Git

La instantánea incluye los cambios previos de Soporte Digital. No se hizo staging ni commit.

```text
frontend/src/App.tsx                               |   2 +
 frontend/src/HomePage.tsx                          |   3 +
 frontend/src/auth/RequireAuth.tsx                  |   3 +-
 frontend/src/auth/useAuth.ts                       |   2 +
 .../src/soporteDigital/SoporteDigitalMiTrabajo.tsx | 124 +++++++++++-----
 frontend/src/soporteDigital/SoporteDigitalUi.tsx   |   9 +-
 .../src/soporteDigital/soporteDigitalHome.test.tsx |   2 +-
 .../src/soporteDigital/soporteDigitalMiTrabajo.css |  75 ++++++++++
 .../soporteDigitalMiTrabajo.test.tsx               |  26 +++-
 .../src/soporteDigital/soporteDigitalWorkApi.ts    |  18 +--
 frontend/src/types/api.ts                          |   2 +
 server/app.ts                                      |   6 +
 server/db/migrations/meta/_journal.json            |  21 +++
 server/db/schema/enums.ts                          |   1 +
 server/db/schema/index.ts                          |   2 +
 server/db/schema/operacionEspecialista.ts          |  10 +-
 server/db/schema/sessions.ts                       |   8 ++
 server/db/schema/users.ts                          |   1 +
 server/helpers/auditLog.ts                         |   8 +-
 server/helpers/fichaViva.ts                        |   4 +-
 server/helpers/proyectos.ts                        |   5 +-
 server/helpers/session.ts                          |  99 +++++--------
 server/helpers/soporteDigitalDrive.ts              |  18 ++-
 server/helpers/soporteDigitalHome.ts               |  27 +++-
 server/helpers/soporteDigitalWork.ts               | 128 ++++++++++++-----
 server/middleware/auth.middleware.ts               |  24 +++-
 server/modules/integrations/google-drive/routes.ts |   5 +-
 server/modules/project-workspaces/root.ts          |   2 +-
 server/routes/auth.routes.ts                       |   6 +-
 server/routes/soporteDigitalWork.routes.ts         |  22 ++-
 shared/soporteDigitalWork.ts                       |  28 ++++
 tests/soporteDigitalWork.test.ts                   | 157 ++++++++++++++++++++-
 32 files changed, 659 insertions(+), 189 deletions(-)
```

```text
M frontend/src/App.tsx
 M frontend/src/HomePage.tsx
 M frontend/src/auth/RequireAuth.tsx
 M frontend/src/auth/useAuth.ts
 M frontend/src/soporteDigital/SoporteDigitalMiTrabajo.tsx
 M frontend/src/soporteDigital/SoporteDigitalUi.tsx
 M frontend/src/soporteDigital/soporteDigitalHome.test.tsx
 M frontend/src/soporteDigital/soporteDigitalMiTrabajo.css
 M frontend/src/soporteDigital/soporteDigitalMiTrabajo.test.tsx
 M frontend/src/soporteDigital/soporteDigitalWorkApi.ts
 M frontend/src/types/api.ts
 M server/app.ts
 M server/db/migrations/meta/_journal.json
 M server/db/schema/enums.ts
 M server/db/schema/index.ts
 M server/db/schema/operacionEspecialista.ts
 M server/db/schema/sessions.ts
 M server/db/schema/users.ts
 M server/helpers/auditLog.ts
 M server/helpers/fichaViva.ts
 M server/helpers/proyectos.ts
 M server/helpers/session.ts
 M server/helpers/soporteDigitalDrive.ts
 M server/helpers/soporteDigitalHome.ts
 M server/helpers/soporteDigitalWork.ts
 M server/middleware/auth.middleware.ts
 M server/modules/integrations/google-drive/routes.ts
 M server/modules/project-workspaces/root.ts
 M server/routes/auth.routes.ts
 M server/routes/soporteDigitalWork.routes.ts
 M shared/soporteDigitalWork.ts
 M tests/soporteDigitalWork.test.ts
?? docs/arquitectura/39-administracion.md
?? docs/reportes/administracion-panhouse.md
?? docs/reportes/soporte-digital-mi-trabajo-continuacion.md
?? docs/reportes/soporte-digital-mis-solicitudes.md
?? frontend/src/admin/AdminApp.tsx
?? frontend/src/admin/AdminConfiguration.tsx
?? frontend/src/admin/AdminOperations.tsx
?? frontend/src/admin/AdminPeople.tsx
?? frontend/src/admin/AdminProjects.tsx
?? frontend/src/admin/AdminUi.tsx
?? frontend/src/admin/admin.css
?? frontend/src/admin/admin.test.tsx
?? frontend/src/admin/adminApi.ts
?? frontend/src/auth/AdminViewAsBanner.tsx
?? frontend/src/auth/adminViewAs.css
?? frontend/src/soporteDigital/SoporteDigitalMisSolicitudes.tsx
?? frontend/src/soporteDigital/soporteDigitalMisSolicitudes.css
?? frontend/src/soporteDigital/soporteDigitalMisSolicitudes.test.tsx
?? frontend/src/soporteDigital/soporteDigitalRequestsApi.ts
?? scripts/create-system-admin.ts
?? scripts/reset-soporte-digital-password.ts
?? server/db/migrations/0093_digital_requests.sql
?? server/db/migrations/0094_admin_role.sql
?? server/db/migrations/0095_administracion.sql
?? server/db/schema/administracion.ts
?? server/db/schema/solicitudArchivos.ts
?? server/helpers/soporteDigitalActions.ts
?? server/helpers/soporteDigitalRequests.ts
?? server/modules/admin/commands.ts
?? server/modules/admin/health.ts
?? server/modules/admin/integrations.ts
?? server/modules/admin/policy.ts
?? server/modules/admin/projects.ts
?? server/modules/admin/queries.ts
?? server/modules/admin/routes.ts
?? server/routes/soporteDigitalRequests.routes.ts
?? shared/admin.ts
?? shared/soporteDigitalRequests.ts
?? tests/admin.test.ts
?? tests/soporteDigitalRequests.test.ts
```
