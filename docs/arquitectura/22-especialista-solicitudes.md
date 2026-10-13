# Especialista · Solicitudes

## Auditoría y owners

La pantalla anterior listaba todos los work items abiertos y decisiones de Jefatura como solicitudes. No distinguía una petición de asignación de su proceso en ejecución. Las solicitudes formales existentes se proyectan desde su origen real; las decisiones excepcionales conservan su bandeja/ruta propia y no se convierten en requests.

| Tipo confirmado | Owner | Origen y resolución |
|---|---|---|
| Asignación de Editor | Jefatura de Edición | Evento EDITOR_SOLICITADO + work item; se resuelve al asignar Editor, no al cerrar Edición |
| Reunión creativa | Líder Creativo | dirección concepto_portada; se resuelve al registrar reunión realizada |
| Contrato de corrector freelance | Talento Humano | Nueva entidad por intervención de Corrección; confirmación de Talento habilita asignación formal |
| Validación de versión | Soporte Editorial | Ronda canónica de Calidad; se resuelve al entregar revisión, con resultado aprobado/comentarios |
| Activación Amazon | Soporte Digital | Work item activacion_amazon automático desde F1; se resuelve con fecha nativa de activación |
| Planificación de lanzamiento | RRPP | Work item planificacion automático según gate por servicio; lifecycle nativo de planificación |

Diseño es asignación directa del Especialista, no request de asignación a otra jefatura. Paquete final no tiene workflow estructurado suficiente: PENDIENTE_VALIDACION_DOCUMENTAL. No se inventan solicitudes por cada correo ni se importan nombres del Excel/mockup.

## Arquitectura

Listado paginado por servidor con joins/batches, filtros tipo/área/estado/periodo/proyecto/búsqueda. Detalle lazy con contexto, historial humano y enlaces existentes. Identidad desde sesión y scope por asignación vigente; manipular requestId/proyectoId no amplía el acceso. URL conserva selección, filtros y página. Escritorio master/detail; tablet y móvil muestran lista y detalle separado, con retorno que conserva filtros.

No existe CRUD libre ni Nueva solicitud. Editor y Creativa nacen exclusivamente de comandos autorizados; Amazon y RRPP son handoffs automáticos ya existentes. Request y proceso conservan estados distintos: Editor asignado resuelve la petición aunque Edición continúe.

## Contratos y comunicación

Contrato por intervención/proyecto, con corrector externo identificado y aceptación declarada por Especialista, businessKey por ronda y unicidad de petición abierta. No sustituye ni firma el contrato legal. No contiene snapshots completos de autor/proyecto. Estados: pendiente, en_revision, requiere_informacion, resuelta, rechazada. Resultado separado: contrato_confirmado o motivo de rechazo. No cancelación universal sin política confirmada.

Talento recibe una bandeja de contratos y puede iniciar revisión, solicitar información o confirmar/rechazar. La pregunta guarda actor y fecha; la respuesta actualiza la misma solicitud, con control de pregunta pendiente y conflicto por estado. La confirmación actualiza el hito canónico de Corrección; el Especialista realiza después la asignación formal. El gate >120 páginas sigue en Decisiones y no se evita mediante contrato.

Creación/respuesta/confirmación/notificación/audit comparten transacción y lock de proyecto. Un doble click no duplica la petición ni aviso. Los permisos del destino no permiten resolver como Especialista. Lecturas no generan audit. Enlaces conservan storage Drive; no se agrega Subir archivo. sourceId/workItemId/versionId permiten futura integración driveFileId/deliverableId sin usar carpetas como fuente de estado.

## Integración

Mi trabajo muestra solicitar antes de enviar, espera de Talento al enviarse, responder cuando requiere información y formalizar tras confirmarse. El formulario se abre desde Corrección del Command Center. Resueltas es solo lectura; outcome procede del dominio, no de un texto simulado. Historial usa eventos auténticos; no se fabrica recepción ni fecha de resolución de registros legacy.
