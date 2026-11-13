# Experiencia editorial: Inicio, Proyectos y Guía

Estado: implementación local en validación. **Aceptación visual pendiente; la tarea no se considera cerrada.** Este informe continúa los cambios locales del informe `continuacion-guia-proyectos.md`; no sustituye su historial ni implica despliegue.

## Diagnóstico AS-IS → TO-BE

| Experiencia | Implementación anterior | Refactor |
| --- | --- | --- |
| Inicio del Especialista | `ProjectPortfolio home`, misma tarjeta que Proyectos | Bandeja propia de acciones, asignaciones nuevas, esperas y riesgos |
| Portafolio | Posición/responsable/hito globales; esperas agregadas | Proceso principal, caminos paralelos relevantes, hitos y riesgos por proceso |
| Guía | Primer proceso accionable tomado como posición; acceso a secciones completas | Línea principal independiente de la prioridad; selector explícito y operación del paso |
| Inicio de Jefatura | KPIs, bandejas, portafolio resumido y actividad superpuestos | Asignaciones, decisiones, riesgos y carga del equipo |

El diagnóstico se presentó antes de editar código.

## Pantallas consolidadas

- Se eliminó `EspecialistaInicioPage.tsx`, que estaba desconectado de la ruta real.
- Se retiraron las implementaciones `LegacyMisProyectosPage` y `LegacyProyectosJefaturaPage`; los dos accesos usan el mismo portafolio con contexto de rol.
- Se reemplazó el Inicio anterior de `PanelJefaturaPage`; ya no monta su mezcla de KPIs, colas, solicitudes recientes e historial.
- Inicio del Especialista dejó de reutilizar `ProjectPortfolio`. Se eliminó la variante `home` y su agrupador.
- Los alias de navegación anteriores siguen redirigiendo al proyecto o a Proyectos, conservando contexto válido.
- Objetivos del mes sigue siendo un gestor real de compromisos propios y asignados, con edición e historial. Se conserva como enlace secundario desde Inicio del Especialista. Jefatura lo mantiene en Indicadores.

## Especialista

**Inicio:** “Tu operación editorial”, con franja compacta de proyectos activos, con acciones, con esperas, vencidos y nuevas asignaciones. Los conteos se calculan sobre la cartera completa, antes de paginar el portafolio. Son conteos de proyectos; las listas muestran operaciones por proceso.

Cada acción identifica libro, proceso, acción concreta, motivo y plazo conocido, con enlace al paso correspondiente. Las esperas identifican a quién se espera, desde cuándo y su plazo, sin clasificarse como tareas del Especialista. Conservan el CTA “Ver proyecto” y muestran cuántos otros procesos están disponibles.

Una asignación es nueva cuando existe una asignación canónica vigente y aún no hay gestión registrada. Consultar Inicio no escribe datos. “Comenzar proyecto” registra recepción mediante el comando existente y abre Preparación inicial. No se inventan fechas para asignaciones legacy que solo tienen FK.

**Proyectos:** búsqueda y filtros de activos, acciones disponibles, esperas, bloqueos, riesgos e históricos. Cada fila muestra identidad, servicio, fecha objetivo, proceso principal y caminos paralelos relevantes. Los procesos futuros aún no habilitados permanecen en el selector de la guía para evitar convertir cada fila en una lista de todas las fases posibles.

## Guía y procesos paralelos

- “Estás aquí” sigue la línea de producción y conserva la espera del proceso principal. La prioridad de acción se proyecta por separado.
- Un selector en lista permite cambiar de proceso; muestra estado, acción o espera y requisitos faltantes. Al abrir uno, se concentra la vista en ese paso.
- Solicitudes y asignaciones muestran fechas y persona cuando existe evidencia. Las entregas muestran fecha de recepción y enlace; una hora desconocida no se inventa.
- Preparación mantiene los campos de cada paso, guardado y recorrido de pasos anteriores.
- Envío de capítulos, briefs y conceptos al Autor usa formularios dentro del paso y los comandos nativos. No registra una segunda recepción manual.
- Corrección concentra inicio/alcance, contrato, asignación o revisión de entregables según la operación proyectada. Las respuestas solicitadas por Jefatura se resuelven dentro del paso y pasan a espera al reenviarse.
- Diseño concentra el entregable actual o la siguiente solicitud. La recepción de tres archivos no equivale al cierre: se conservan aprobaciones y cierres nativos. Calidad concentra la ronda vigente cuando corresponde actuar.
- Sin Especialista asignado, no se presentan procesos disponibles para operar.
- Los procesos completados y sus registros se consultan mediante despliegues de historial. Los cambios sensibles de preparación y títulos siguen protegidos en el servidor cuando existe trabajo posterior.
- La convergencia editorial y la solvencia siguen protegiendo preparación y liberación del Paquete Final. No se agregó un estado alternativo de solvencia ni un permiso para omitir gates.

## Jefatura

**Inicio:** “¿Dónde debo intervenir?”, con asignaciones de Especialista/Validador, decisiones reales y clasificación Express pendiente, proyectos con riesgos explicados y carga compacta del equipo. Los enlaces abren el contexto nativo de asignación o decisión.

**Proyectos:** comparte la verdad de los procesos con el Especialista, añade su nombre y permite supervisar. La guía muestra intervenciones pendientes del proyecto, asignación de Validador donde corresponde y consultas de procesos; los formularios del Especialista no se habilitan para Jefatura.

## DTOs y fuente de verdad

- `ProjectGuide` separa `currentPath` de `priorityAction`; incorpora `requiresUserAction`, `waitingOn`, `availableProcesses`, `blockedProcesses`, `activeProcesses`, `nextMilestones` y `supervisionActions`.
- Cada `GuidePath` conserva su espera, requisitos, bloqueos, solicitud, asignación, persona, plazo y evidencia de entrega. La acción puede identificar capítulo, intervención, decisión o entregable de Diseño.
- `GuidedProjectSummary` reemplaza posición/responsable/esperas/hito globales por `mainProcess`, `parallelProcesses`, `risks`, `nextMilestones` y `newAssignment`.
- `OperationHome` es un DTO propio para Inicio; no es la página 1 del portafolio ni una colección de tarjetas reutilizadas.
- `loadProjectExperiences` usa lecturas en lote compartidas. Las pruebas comparan el número de consultas con una cartera mayor. No invoca el Command Center por cada proyecto.
- Las decisiones y entregas se incorporan al lector de hechos existente. No hay tablas nuevas ni un segundo workflow persistido.
- Solicitudes conserva su función de seguimiento, con resultados derivados de asignaciones, revisiones y entregas nativas.

## Auditoría de los casos QA

Evidencia: `../evidencias/experiencia-operativa/qa-source-audit.json`.

- `QAS-36FABF`: servicio **SE**, títulos completos, solicitud creativa resuelta, intervención creativa en curso sin brief, ninguna Corrección creada. Esperar al Líder Creativo e iniciar Corrección son caminos paralelos válidos. La mezcla estaba en el resumen global del proyecto.
- `QAS-BD483A`: servicio **EF**, títulos incompletos y solicitud creativa pendiente. Es un fixture inconsistente respecto de los requisitos actuales; no se corrigió silenciosamente ni se ocultaron los requisitos.
- `QAS-7AE437`: servicio **CR**, solicitud creativa rechazada y sin trabajo creativo generado. Rechazo y ausencia de ejecución son coherentes.

La regresión automatizada reproduce el caso SE mediante creación y aceptación nativa de una solicitud creativa; no fuerza un avance global para hacerlo pasar.

## Validación y límites de aceptación

Los resultados y comandos quedan en `../evidencias/experiencia-operativa/`:

- `tests-final.txt`: **164 pruebas aprobadas en 11 archivos** de integración y renderizado. `tests-current.txt`: **24 aprobadas**, repitiendo las pruebas de la guía y sus pantallas después de los últimos ajustes del portafolio; no son 24 casos adicionales.
- `tests.txt`: ejecución ampliada de 14 archivos: **202 aprobadas y 23 fallidas**. Corrección (7), Diseño (15) y Decisiones (1) conservan pruebas de accesos o entregas retirados. Se guardó la salida completa; no se relajó RBAC para satisfacerlas. La suite completa no se declara verde.
- `backend-build.txt` y `frontend-build.txt`: compilaciones. Vite mantiene la advertencia de tamaño del bundle.
- `http-smoke.txt`: HTTP real sobre PostgreSQL desechable, tres proyectos y dos roles. Verifica consistencia portafolio/guía, Inicio propio, nueva asignación, espera de Editor, Corrección paralela y asignación pendiente de Jefatura.
- `proxy-smoke.json`: sesión y DTO de Inicio a través del proxy de Vite; confirma también que la hoja de estilos se sirve. No es una prueba visual.
- `git-diff-stat.txt`, `git-status.txt` y `diff-check.txt`: estado local. Incluyen también la continuación anterior y enumeran archivos nuevos todavía sin seguimiento.

Diff de archivos rastreados al terminar: **36 archivos, 536 inserciones y 1175 eliminaciones**. Los archivos nuevos se enumeran aparte en `git-status.txt`; Git no los suma a `diff --stat` hasta incorporarlos al índice. `git diff --check` terminó con código 0.

**QA responsive: pendiente de revisión visual.** Se implementaron reglas para pantallas pequeñas, controles flexibles, texto largo y foco visible, pero eso no sustituye comprobar la interfaz. Computer Use volvió a informar `The browser access host is unavailable`. No se generaron capturas ni se declara validado el recorrido manual completo EF.

El entorno de revisión local usa Vite en `http://127.0.0.1:5177` y API en `127.0.0.1:3017`, con base desechable `panhouse_operation_preview_review`. Los accesos de QA son `/api/__qa/session/especialista` y `/api/__qa/session/jefatura` sobre Vite. El script está separado de la aplicación normal y escucha únicamente en localhost. No ejecuta workers ni contacta Drive o correo reales. Se conservaron las bases de ensayos anteriores; el script se niega a sobrescribir una base existente.

Pendientes para cerrar la aceptación: revisión manual de ambos roles en escritorio y móvil, recorrido EF completo con documentos reales en un entorno autorizado y actualización de las pruebas legacy incompatibles con los flujos actuales. Los cambios permanecen locales, sin commit ni despliegue.
