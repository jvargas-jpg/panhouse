# Especialista · Mi trabajo

## Auditoría y decisión

Se revisaron status, diff completo y los últimos diez commits antes de editar. HEAD inicial `6d6ce6a`; los cambios ajenos de Jefatura/Indicadores permanecen separados. La pantalla anterior combinaba acciones agrupadas, vencimientos de otros roles y actividad, sin búsqueda ni paginación.

Fuentes: manual exacto `(3)` en `fuentes-negocio`, Matriz IA disponible sin sufijo `(1)` en `panhouse_antigua`, esquemas y workflows de Edición, Corrección, Creativa, Diseño, Calidad, Amazon y RRPP. La matriz es evidencia del control operativo, no plantilla ni importación de datos.

La cola es una proyección por lotes de hechos nativos, con identidad por capítulo, intervención, versión o ronda. No crea una checklist, estado macro nuevo ni una tabla de tareas manuales. Mis proyectos conserva una fila por proyecto; aquí un proyecto puede aparecer muchas veces. Solicitudes contiene los handoffs formales; la cola solo cuenta acción propia como pendiente, y puede mostrar una dependencia como espera.

## Contrato y temporalidad

Cada item entrega proyecto canónico, proceso, actionType, fuente/id/businessKey, workItemId cuando existe, contexto, dueAt y precisión, waitingSince, waitingOn, blocker y CTA autorizado. Las entregas usan timestamps/fechas reales y referencias a enlaces; Drive no calcula estado o SLA.

Pendientes cuenta acciones propias abiertas, incluidas vencidas, excluidas esperas y bloqueos. Vencidas exige plazo pasado; DATE vence al terminar su día en Caracas, timestamp al cruzar su instante. Hoy contiene vencidas y plazo de hoy. Acciones disponibles sin plazo se consultan en Pendientes, accesible desde el contador y un tab adicional. Próximas contiene acciones propias con fechas futuras sin horizonte inventado. Las dependencias futuras permanecen en Esperando. Edición no se ofrece para Sello cuando no existe intervención nativa. Esperas vencidas se convierten en seguimiento, sin duplicar la misma dependencia.

Los bloqueos proceden de gates o work items bloqueados explícitos. La ausencia de actividad no bloquea. No se ofrece el CTA de solicitar cuando falta título, revisión previa o verificación interna de cubierta. Los formularios siguen en Operación del Command Center; no existe botón genérico Completar tarea.

## Seguridad y rendimiento

Identidad desde sesión, ownership canónico por asignación vigente de proyecto; historial terminado nunca resucita el FK. Lecturas relacionadas por lotes antes de proyectar, filtrado/orden/paginación en backend y DTO limitado. Los endpoints nativos revalidan el acceso al actuar. No se audita lectura ni navegación. Caché por usuario y URL, invalidada al mutar.

## Entregas y límites

Corrección entregada pasa de espera a revisión. Cada capítulo disponible produce su envío propio. Diseño mantiene solo la versión actual y distingue muestra/cubierta/handoff a Calidad. Calidad identifica fase/ronda y no encarga validar al Especialista. Amazon y Lanzamiento tienen activación automática nativa: no se inventa una acción de activación repetida. No hay paquete final estructurado ni primer contacto con deadline; esas tareas se omiten.

La extensión contractual de la entrega de Solicitudes permite petición a Talento por intervención; se consulta el mismo contrato para espera, respuesta y asignación formal. Compatibilidad futura con Drive mediante sourceId/workItemId y referencias de entregables; sin storage, uploads ni API externa añadida.
