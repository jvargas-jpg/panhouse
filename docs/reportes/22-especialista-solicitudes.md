# Entrega de Solicitudes y revisión de Mi trabajo

Fecha: 12 de octubre de 2026. Base inicial: `6d6ce6a`.

Solicitudes se convirtió en una bandeja de coordinación basada en hechos de los procesos existentes. Mi trabajo se revisó y corrigió después de la implementación realizada por Claude Code. No se importaron datos del mockup ni de la matriz de negocio. Los ejemplos de QA viven exclusivamente en una base aislada.

## Auditoría, arquitectura y negocio (A–I)

La vista anterior consideraba cualquier work item abierto una solicitud, mezclaba decisiones excepcionales y no distinguía una petición de asignación de la ejecución posterior. Se encontraron work items con businessKey, historial de asignaciones, auditoría, notificaciones y dominios específicos de Creativa, Corrección, Diseño y Calidad. Se reutilizan esas fuentes, sin tabla genérica de requests ni CRUD libre.

Se revisaron el manual exacto `(3)`, la matriz disponible en `panhouse_antigua` y los workflows implementados. Las decisiones y límites se detallan en [la arquitectura](../arquitectura/22-especialista-solicitudes.md).

| Tipo | Owner | Identidad / lifecycle / outcome |
|---|---|---|
| Asignación de Editor | Jefatura de Edición | Work item + `EDITOR_SOLICITADO`; pendiente hasta la asignación. Resuelta aunque Edición continúe. Outcome identifica al Editor. Sello sin intervención de Edición no habilita solicitar. |
| Reunión creativa | Líder Creativo | Concepto de portada + work item. Se resuelve con reunión realizada; sigue separado del desarrollo creativo. Conserva gates de títulos y feedback por servicio. |
| Contrato freelance | Talento Humano | Intervención de Corrección + ronda contractual. Pendiente → revisión/información → confirmación o rechazo. Outcome y motivo separados del estado. |
| Validación | Soporte Editorial | Work item de fase/ronda/versión de Calidad. Resolución con revisión entregada; outcome aprobado o comentarios. |
| Activación Amazon | Soporte Digital | BusinessKey `activacion_amazon`, activado automáticamente desde F1. Resolución con fecha nativa de activación. |
| Lanzamiento | RRPP | BusinessKey `planificacion`, creado por el gate del servicio. Petición resuelta al comenzar la planificación; lanzamiento puede continuar. |

Diseño es asignación directa del Especialista. No se inventaron solicitudes para paquete final, primer contacto con SLA ni cada correo: falta un lifecycle nativo verificable. Los registros históricos incompletos no reciben fechas de recepción o resolución fabricadas.

## Experiencia de uso (J–R)

Sidebar común: Inicio, Mis proyectos, Mi trabajo, Solicitudes y Objetivos del mes. Encabezado y cuenta únicos. Resumen: abiertas, en revisión, requieren información y resueltas. Los contadores respetan los filtros; abiertas incluye información pendiente. Tabs: abiertas, requieren información, resueltas y todas.

Filtros por tipo, área destino, estado, proyecto, fecha de solicitud y búsqueda sin acentos por título/autor/código/tipo. Paginación en servidor; no repite páginas ni utiliza una página inválida del cliente. La URL conserva filtros, página, selección y panel. El listado devuelve un DTO reducido; el detalle se carga bajo demanda.

Escritorio usa lista y detalle. Tablet/móvil usan lista y detalle separado con retorno conservando filtros. El detalle muestra contexto, estado/outcome, historial con actor/fecha y enlaces existentes. Una pregunta de Talento habilita respuesta sobre la misma solicitud; el id de pregunta evita sobrescribir una respuesta obsoleta. Resueltas no ofrece resolver de nuevo.

Los filtros y respuestas usan dialog nativo, labels y foco de retorno. Existen estados de carga, error con reintento y vacíos por tab/filtros. No se incorporó un botón genérico Nueva solicitud, Completar o Subir archivo.

Los enlaces a entregables conservan su almacenamiento actual. Se incluyen sourceId/workItemId/businessKey/versión como base para una futura integración Drive; no se implementaron uploads, webhooks ni Drive API.

## Workflows e integración (S–AB)

Editor se solicita desde la operación nativa; un doble clic conserva una petición, auditoría y aviso. Jefatura asigna y la petición pasa a resuelta. La operación conserva «Editor solicitado» y enlace a la petición cuando sigue pendiente.

Freelance: el Especialista declara disponibilidad y solicita contrato de un candidato; Talento inicia revisión, pregunta, confirma recepción o rechaza con motivo. La respuesta guarda texto, actor y fecha en la misma ronda. Confirmar actualiza el hito de Corrección; luego el Especialista formaliza asignación. El booleano enviado por el navegador no permite autoconfirmar el contrato. Cambiar candidato requiere una ronda confirmada para esa persona. La revisión previa de tripa >120 páginas conserva su gate de Jefatura. El sistema registra el hito operativo; no firma un acuerdo legal.

Creativa, Calidad, Amazon y RRPP se proyectan desde sus workflows propios, sin comandos universales de resolución. Las activaciones automáticas no generan tareas repetidas de activación manual.

Mi trabajo pasa de coordinación propia a espera de Talento; información pendiente genera Responder y contrato confirmado genera Formalizar asignación. Cada capítulo y versión tiene contexto propio. Inicio utiliza las nuevas proyecciones para acciones/solicitudes; el DTO anterior permanece para la cartera y sus vencimientos. El Command Center reutiliza la cola para la atención del Especialista y conserva formularios nativos.

Mutaciones invalidan cachés relacionadas. Creación/gestión contractual, notificaciones y auditoría comparten transacción. Lecturas y navegación no generan eventos. Los avisos se dirigen al owner vigente; no se duplican en peticiones concurrentes.

## Seguridad, rendimiento y validación (AC–AG)

Identidad exclusivamente de sesión. Scope por asignación vigente; un FK antiguo no resucita una asignación finalizada. RBAC para Especialista/Talento, IDOR en detalle y comandos, parámetros validados y SQL parametrizado. Se revalida ownership y estado del proyecto bajo lock al actuar.

Listado de solicitudes: una consulta SQL con scope, fuentes, filtros, resumen y paginación; sin fichas completas ni N+1 por fila. Detalle lazy. Mi trabajo carga datos por lotes. El Command Center reutiliza su dashboard y elimina cuatro lecturas antiguas duplicadas; la prueba de límite de consultas pasó en la revisión dirigida.

Se agregaron 23 pruebas de Solicitudes y 24 de Mi trabajo. Cubren permisos, IDOR, ownership histórico, idempotencia concurrente, lifecycle de Editor, información/respuesta, gates, confirmación de Talento, asignación formal, plazos, capítulos separados, estados, filtros y paginación. Las pruebas anteriores de freelance se adaptaron al flujo real de Talento, conservando las verificaciones de negocio.

La primera regresión congelada obtuvo 1.226/1.228: una expectativa antigua de capítulos agrupados y el límite de consultas del Command Center fallaron. Ambos se corrigieron y las 18 pruebas dirigidas del Command Center pasaron. Las 47 pruebas nuevas tienen una ejecución aprobada: 46 en la ejecución conjunta y una repetida aisladamente después de un timeout de 30 segundos; esa repetición pasó en 5,1 segundos sin cambiar código. Se conservaron ambos resultados, sin borrar el timeout original.

Backend y frontend de la revisión congelada compilan; sus builds incluyen typecheck. Vite mantiene el aviso de tamaño de bundle existente. El ciclo HTTP sobre el backend compilado verificó contrato y Editor: login real, RBAC/IDOR, respuesta conservada, confirmación de Talento, candidato autorizado, formalización, resuelta de solo lectura y petición de Editor concurrente sin duplicación. Editor asignado resuelve la petición mientras su work item continúa en progreso. Evidencia: [e2e-http-final.json](../evidencias/especialista-solicitudes/e2e-http-final.json).

La segunda regresión completa sigue en ejecución independiente al cerrar esta parte de la entrega. No se declara aprobada todavía. `../evidencias/especialista-solicitudes/validacion-final.json` registra su estado y se actualiza al terminar. Los tests usan PostgreSQL aislado en el puerto 6545; no truncan la base principal.

## QA visual y límites (AH–AP)

Primera captura aislada a 1440×900: [desktop-qa-primera.png](../evidencias/especialista-solicitudes/desktop-qa-primera.png). Se observaron lista con cinco filas visibles, texto demasiado amplio y detalle largo. Se redujeron padding y line-height de filas, ajustaron tipografías y se preservó la identidad visual compartida con Mi trabajo/Mis proyectos.

La referencia aporta master/detail, resumen de cuatro tarjetas y foco en preguntas pendientes. Se conservaron la marca real y navy/dorado de Panhouse; no se copiaron los nombres ni las portadas ficticias. El detalle muestra evidencia nativa, no campos de tarifa o semanas inexistentes.

En navegador se verificó la pregunta de Talento y se envió una respuesta de QA. Después se detectó y corrigió la selección inicial no persistida en URL, que podía cambiar el detalle tras responder. El ciclo contractual completo y Editor están cubiertos por integración backend.

**Pendiente de verificación visual final:** escritorio corregido, comparación final con Mi trabajo/Mis proyectos, tablet 768×1024, móvil 375×812, Escape/foco y estados de error en navegador. La conexión con Chrome dejó de responder; tras pedir reconexión, el inventario devolvió cero navegadores. No se presentan esos checks como aprobados. El CSS responsive y los componentes están implementados, pero eso no sustituye sus capturas y pruebas visuales.

Límites reales: paquete final sin workflow estructurado, primer contacto sin deadline nativo, ausencia de uploads/Drive API y recepción histórica incompleta. La confirmación de Talento no ejecuta firma electrónica. El periodo filtra fecha de solicitud. Las esperas con plazo futuro permanecen en Esperando, no en Próximas.

## Git y entrega (AQ–AR)

Se revisaron diff y cambios existentes. Indicadores/Jefatura y otros artefactos ajenos quedan fuera del índice de esta entrega, incluidos hunks ajenos de `server/app.ts` y `AppLayout.tsx`. No se hizo push. La revisión final y el commit se indican en el archivo de validación al finalizar.
