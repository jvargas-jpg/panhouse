# Revisión de Mi trabajo

La implementación entregada por Claude Code necesitaba correcciones de negocio, además de ajustes visuales. Se conservaron la estructura y navegación, y se reemplazó la proyección operativa para representar hechos nativos.

| Hallazgo | Corrección |
|---|---|
| Capítulos agrupados por proyecto | Una acción por capítulo con contexto y enlace al formulario correspondiente. |
| Acciones sin fecha tratadas como Hoy | Pendientes muestra acciones propias disponibles; Hoy exige plazo de hoy o vencido. |
| Fecha de entrega usada como deadline | Entrega y deadline separados; el día de Caracas y la precisión de timestamp determinan vencimiento. |
| Esperas futuras duplicadas en Próximas | Permanecen en Esperando. Próximas exige acción propia con plazo futuro. |
| Contadores de entrega basados en prefijos | Conteo por fecha/timestamp real de entrega recibida. |
| Dependencias filtradas por texto | Owner estructurado con tipo, nombre y waitingSince. |
| Corrección entregada desaparecía al completar work item | Revisión propia sigue hasta registrar el resultado. Cancelados quedan excluidos. |
| Versiones antiguas y verificaciones de cubierta mezcladas | Solo versión actual; gates de Creativa y Jefatura antes de enviar cubierta. |
| Contrato freelance autoconfirmable por Especialista | Petición y confirmación de Talento; después asignación formal del Especialista. |
| Servicio Sello ofrecía solicitar Editor | Sin Edición nativa se conserva No aplica; guard también en backend. |
| CTA genérico sin contexto | ActionType, source/businessKey, workItem, versión/ronda/capítulo y CTA autorizado. |
| Página extrema renderizada desde URL | Se utiliza la página ajustada por servidor. |
| Atención de Command Center duplicaba consultas | Reutiliza el snapshot y elimina cuatro consultas antiguas. |

Sidebar, encabezado, resumen, tabs, búsqueda, filtros por proceso/proyecto/dependencia y paginación comparten identidad con las otras pantallas del Especialista. Hay estados de carga/error/vacío y filtros en dialog para móvil. Los bloqueos conservan su motivo y no ofrecen un CTA que evite el gate. La página no permite completar tareas manuales ni ejecutar el trabajo de Editor, Corrector, Diseñador o Validador.

Las dependencias vencidas pasan a seguimiento propio. Corrección, Creativa, Diseño y Calidad usan sus estados y entregables nativos. Amazon y RRPP conservan activación automática. No se fabrican primer contacto con SLA, paquete final ni integración externa Drive. SourceId/workItemId/contexto permiten extender entregables después.

RBAC y ownership canónico se prueban en backend; búsqueda, filtros y paginación se resuelven allí. Los datos se cargan por lotes. Se agregaron 24 pruebas dirigidas; el resultado definitivo está en [validacion-final.json](../evidencias/especialista-solicitudes/validacion-final.json). Se mantienen las pruebas de permisos, fechas sin plazo, DATE/timestamp, revisión de entrega, versiones, gates y conteos.

La arquitectura está en [21-especialista-mi-trabajo.md](../arquitectura/21-especialista-mi-trabajo.md). El [reporte conjunto](22-especialista-solicitudes.md) documenta workflows, regresión, compilaciones, evidencia y git. La revisión visual final de escritorio/tablet/móvil y comparación con Mis proyectos sigue pendiente por desconexión del navegador; los artefactos anteriores de Claude no se presentan como verificación de esta proyección nueva.
