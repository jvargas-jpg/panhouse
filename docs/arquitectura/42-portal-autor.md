# Portal del Autor — auditoría previa e implementación

Auditoría local: 11 noviembre 2026. Checkout limpio antes de comenzar.

## Arquitectura encontrada

Fastify/Drizzle/PostgreSQL; React/React Query; sesiones opacas, hash SHA-256, cookie httpOnly, Argon2. `autor` ya pertenece al enum de roles. No existe registro público. `usuarios.autor_id` referencia `autores`; proyectos conserva autor principal y `proyectos_autores` representa coautoría. Base local: 163 autores, 139 proyectos, 143 asociaciones; ninguna cuenta Autor ni vínculos duplicados. No se enlazarán cuentas por coincidencia de correo.

Portal previo: `/mis-libros`, listado con SELECT limitado, manuscrito y decisión mutable de portada en columnas de proyecto. Esa decisión no conserva artefacto, revisión, actor ni historial. Se preservan las columnas como legado sin reconstruir decisiones históricas. Project 360 y los módulos internos usan RBAC propio.

`decisiones` pertenece a Jefatura y tiene CHECK de exactamente dos orígenes; reutilizarla para autores rompería su contrato. `solicitudes_area` sí admite ampliar tipos y se reutiliza para solicitudes de pausa. `pausas` es la fuente canónica para exclusión de SLA; pausa formal requiere confirmación de pago y Jefatura. `work_items` y `project_assignments` son la autoridad operativa; especialista actual se resuelve por historial con fallback a FK.

Notificaciones soportan usuario destinatario y ruta; broadcasts son apropiados para ciertos equipos pero jamás para autores. BullMQ existente solo transporta WhatsApp; no hay servicio SMTP. Drive corporativo conserva OAuth cifrado y espacios por proyecto; múltiples entregas conservan solo URL y no revisión. El portal no debe listar carpetas internas ni compartirlas.

## Diseño

Una solicitud genérica de aprobación, artefactos vinculados a documentos compartidos explícitamente, decisión final e inmutable y revisiones sucesoras. Documentos capturan revisión binaria de Drive fijada con keepForever; descarga autenticada por backend. Documentos nativos deben exportarse a PDF para revisión exacta. Nunca se concede acceso a la carpeta ni se sirve la revisión actual por accidente. Se reutilizan sesiones, usuarios, autores, proyectos, asignaciones, work items, auditoría, notificaciones, solicitudes y pausas.

Cada aprobación tiene un work item de espera y un origen del dominio. Backend aplica la decisión y libera o devuelve el origen; el cliente nunca elige al empleado. Solicitudes/decisiones/notificaciones/outbox/auditoría se escriben transaccionalmente. Deadlines solo calculan demora: no resuelven ni cierran solicitudes. Correo mediante outbox persistente, reintentos y claves de deduplicación; activación y recuperación usan tokens aleatorios de un solo uso almacenados como hash.

La relación de acceso es cuenta autenticada → autor_id → autor principal o coautor explícito del proyecto. Una aprobación/documento requiere además destinatario exacto. No hay reclamo público de proyectos. El alta controlada valida al autor y conserva una única cuenta por autor.
