# Administración PanHouse

Auditoría inicial: 18 archivos modificados y 14 sin seguimiento, correspondientes al trabajo digital anterior y un script preexistente de contraseña. No se ejecuta ese script ni se alteran esas funcionalidades.

No existía rol admin: Dirección accede al CRM y administra Google Drive. `sesiones` guarda SHA-256 del token, TTL y usuario; el rol y la activación se revalidan contra PostgreSQL en cada petición. No hay heartbeat, invitaciones, backup monitorizado ni un catálogo editable de permisos. BullMQ contiene provisioning de workspaces y notificaciones. Las plantillas Drive usan folderKeys y snapshot/version por workspace. Fases/pasos/servicios no tienen versionado por proyecto: edición de sus plazos y relaciones se mantiene restringida. `solicitudes_area`, `decisiones` y `contratos_correccion` son lifecycles diferentes y se consultan con una proyección común conservando su familia.

La evolución introduce `admin`, sin convertir automáticamente Dirección. La política administrativa vive en `shared/admin.ts`; las rutas `/api/admin` tienen guard de sesión, permiso, origen para escrituras y DTO explícito. No hay bypass general de RBAC para los endpoints operativos. Cada intervención usa motivo, clave de idempotencia, comprobación de versión, transacción e historial canónico. `admin_operations` registra reintentos, no sustituye auditoría ni entidades operativas.

Sesiones: identificador público aleatorio distinto del hash de cookie, revocación persistente, último uso con resolución máxima de un minuto e IP/user-agent solo administrativos. No se declara «online». Eventos de seguridad separados de actividad de negocio. View-as reside en la sesión del Admin; la identidad real se conserva y todas las mutaciones quedan bloqueadas en servidor durante esa vista, salvo salir del modo o cerrar sesión.

El pipeline agrega work items paralelos y asignaciones en SQL, mantiene una fila por proyecto y consulta servidor para filtros/páginas. Las columnas siguen tipos registrados; las fases configuradas se muestran junto con sus pasos, sin inventar tareas futuras ejecutadas. La ficha reutiliza el expediente existente, excluyendo cuenta Amazon y credenciales. Drive usa servicios y folder associations existentes; la observación no crea ni mueve carpetas.

Las operaciones que pueden invalidar entregas aprobadas, estados externos o dependencias de otros procesos requieren un comando específico del dominio. No se ofrece «forzar todo». Las reaperturas se limitan a trabajo editorial completado sin entregas ni capítulos, con Editor vigente y proyecto abierto: reparación de un cierre sin evidencia, no retroceso de aprobaciones reales.

El informe final en `docs/reportes/administracion-panhouse.md` recoge los resultados, inventario y límites de QA.

## Entrada local y operación

La aplicación envía al rol `admin` a `/admin/inicio`. La cuenta de Dirección sigue accediendo a su experiencia habitual. `scripts/create-system-admin.ts` sirve únicamente para crear una cuenta administrativa local nueva en desarrollo: rechaza cuentas existentes y guarda la credencial generada en `secrets/panhouse-system-admin.local.json`, ignorado por Git. No cambia contraseñas ni promueve usuarios. No debe emplearse como mecanismo de aprovisionamiento de producción.

El fingerprint del ledger excluye la contraseña inicial: no almacena un verificador rápido de la credencial. Repetir el alta con la misma clave y el mismo propósito público devuelve la cuenta creada; cambiar el campo de contraseña en ese reintento no modifica la credencial original. No existe una acción implícita de restablecimiento.

El guard de solo lectura también rechaza el callback OAuth GET de Drive durante view-as, porque esa ruta puede cambiar la integración. Las consultas siguen utilizando el ámbito del usuario efectivo. La actividad interna de autenticación puede actualizar la fecha de uso de la sesión.

Para editar fases, pasos, tiempos o relaciones de servicio de forma segura falta una versión efectiva y un snapshot por proyecto, junto con comandos de migración explícita y pruebas de compatibilidad histórica. Mientras tanto solo se modifica la disponibilidad de servicios para altas futuras. El constructor canónico del proyecto comprueba esa disponibilidad dentro de su transacción.

La auditoría es inmutable desde la aplicación. Una garantía adicional contra modificación directa por operadores de Postgres requiere separar privilegios de escritura y retención en infraestructura; no está implementada por estos endpoints.

Las referencias de responsable que solo existen en `proyectos.*Id` se presentan como referencias guardadas, con fecha desconocida. No se convierten en historia fechada durante una consulta. Una reasignación registra el responsable anterior en audit y empieza la asignación canónica en su fecha real. Si ya existe historia canónica para ese rol, prevalece sobre el puntero. La acción de reparar referencia alinea el puntero con la asignación vigente, sin generar un periodo de asignación ficticio. El cómputo de responsabilidades de la persona usa la misma distinción y evita duplicar una referencia que ya tiene historia.

Las cuentas de Autor se vinculan a registros existentes mediante la búsqueda canónica. Se conserva `autorId` en el alta auditada y se muestra el autor vinculado al revisar la cuenta. Un alta administrativa no crea otra identidad editorial.
