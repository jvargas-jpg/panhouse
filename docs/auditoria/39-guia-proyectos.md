# Proyecto como guía editorial

## Auditoría previa a los cambios

Se revisaron HomePage, navegación de ambos roles, PanelJefaturaPage, ProyectosJefaturaPage, SeguimientoPage, MisProyectosPage, MiTrabajoPage, SolicitudesPage, ProyectoCommandCenterPage, operacionWorkflow, CommandCenterProceso y formularios de preparación/edición/corrección/diseño/calidad. En servidor: Command Center, Ficha viva, preparación, gates, configuración servicio_fases/fases/pasos, work_items, project_assignments, solicitudes de Editor/área/Validador, entregas editoriales, Drive, correcciones y solvencia.

La arquitectura conserva operaciones útiles, pero la experiencia duplica portafolio y seguimiento. React calcula una línea fija preparación→edición→corrección→diseño→calidad. El backend reúne hechos, pero no entrega un contrato uniforme de requisitos, actor que debe actuar, opciones paralelas ni canContinue. Preparación no es actualmente un gate para las operaciones posteriores. Jefatura recibe componentes compartidos con controles del Especialista. Los objetivos viven bajo Seguimiento. La Ficha permite registrar paquete cargado sin convergencia editorial y bloquea su preparación por solvencia. Editor tiene validación/carga de Drive y registro explícito de entrega, pero no detector de entregables correlacionados.

## Decisiones de implementación

La guía será una **proyección** del dominio existente, sin tabla de estados ni segundo motor. Ambos roles reciben los mismos hechos, requisitos y esperas; las capacidades y acciones dependen de su rol. Las escrituras continúan en las operaciones canónicas. Continuar se valida en backend y orienta navegación; no marca procesos manualmente como completados.

El proyecto será la entrada a la operación. Se conservarán rutas históricas como redirecciones y los formularios nativos como adaptadores progresivos. Expediente, equipo y actividad quedan como consultas secundarias. Los objetivos de Jefatura pertenecen a Indicadores. Las solicitudes nacen en el proceso y su bandeja conserva seguimiento y respuestas.

Drive debe identificar proyecto, carpeta persistida, trabajo, ciclo y actor. No se aceptará un archivo solo por su nombre ni se convertirán cambios arbitrarios en avisos. La entrega detectada reutilizará el comando canónico, conservando auditoría e idempotencia.

Paquete Final distinguirá preparación editorial de liberación financiera. Sus requisitos se resolverán con configuración aplicable y evidencia de las versiones/rondas/entregas existentes; una configuración desconocida debe mostrar la falta de definición, no aprobarse implícitamente. La autoridad financiera vigente se conservará: no se trasladará silenciosamente de Comercial a Cobranzas sin operación respaldada.

## Verificación y reporte final

Pendiente al iniciar: consolidación de rutas, DTO de guía, selector, requisitos compartidos, protección de ediciones anteriores, convergencia, Drive, pruebas de permisos y escenario EF, revisión visual y evidencia Git. Este apartado se completará con los resultados observados y las brechas restantes.
