# 24 · Objetivos mensuales

## Auditoría y alcance

Antes de implementar: `main` limpio, HEAD `05f69f8`. La vista de Especialista era un placeholder; no había objetivos nativos, endpoints ni datos legacy en PostgreSQL. Se revisaron Inicio, Mis proyectos, Mi trabajo, Solicitudes, Command Center, Seguimiento, Indicadores, asignaciones, riesgo, pausas, work items y auditoría.

La copia local de IA Matriz Proyectos PED-FOR-002 tiene SHA256 `812480fe35cd87d83858e47cd863751697eafbc84e6c1611eca0ad57e4b95072`, igual a la auditoría `docs/auditoria/command-center-matriz-ia.json`. Se verificaron 17 hojas de objetivos (febrero 2025–junio 2026, incluidas ocultas). Registran autor, título, Especialista, fecha de paquete final, observaciones y cumplimiento; algunas agregan situación actual. No son tareas ni acreditan por sí solas un cierre nativo. No se importan automáticamente nombres, checkboxes ni fechas de Excel.

## Modelo único

`monthly_goals` conserva Especialista, proyecto opcional, año/mes numéricos, `source` explícito (`JEFATURA`/`ESPECIALISTA`), creador real, título, descripción, tipo, fecha objetivo, referencia de proceso/hito y resultado. Estado base: ACTIVO, CUMPLIDO, NO_CUMPLIDO, CANCELADO. EN_RIESGO es una proyección, nunca un selector editable. La migración es aditiva; no hay tabla legacy que migrar. Si se importa Excel después: ADD → backfill validado por FK/identidad/periodo → migrar lecturas/escrituras → verificar → deprecar. No se exige doble escritura.

Tipos limitados: GENERAL, CIERRE_PROYECTO, ALCANZAR_PROCESO, ALCANZAR_HITO. Se exponen por API, junto al catálogo de procesos nativos. Alcanzar proceso significa apertura de su work item canónico; alcanzar hito significa completar una instancia concreta elegida de ese proyecto. No se asume secuencia lineal ni se activan gates/procesos al definir metas.

La fecha mensual no modifica la fecha contractual. Puede ajustarse a un mes posterior con motivo, conservando el periodo original y su historia: al terminar el periodo, lo aún no logrado es NO_CUMPLIDO. Para trasladar el compromiso a otro mes se crea un nuevo objetivo.

## Ámbito, permisos y concurrencia

Especialista lee sus objetivos, crea para sí con source ESPECIALISTA y edita/cancela solo esos objetivos. Jefatura crea con source JEFATURA y edita/cancela solo ese origen; los propios del Especialista son de consulta. El modelo actual de Jefatura tiene ámbito global (no hay membresía de equipos); se muestran todos los Especialistas activos, en orden alfabético, incluidos quienes tienen cero objetivos. No se inventa un filtro por jefe de proyecto que oculte personas o metas generales. Si se introduce membresía, la guardia central debe adaptarse.

Backend resuelve la asignación actual desde `project_assignments`, con fallback a FK únicamente en registros sin historial. Proyecto ajeno se rechaza tanto al crear como al editar, incluidos hito y proceso. La sesión determina origen/creador; el body es estricto. Lectura por ID/historia aplica ownership antes de responder. Periodos anteriores al mes de Caracas son read-only para ambos roles; no hay override administrativo implícito.

Creación serializada por Especialista y proyecto; clave UUID idempotente por creador, con verificación del payload. Se detectan equivalencias de tipo/proyecto/meta dentro del periodo sin impedir metas diferentes. Edición exige versión `updatedAt` para evitar pisar cambios concurrentes. Goal, auditoría y notificación se escriben en una transacción. Cancelación exige motivo y nunca borra filas.

## Evaluación e historia

Un evaluador de dominio determina resultado, riesgo, razón, fecha, contexto y diferencia de días. Cierre usa `PROYECTO_ESTADO_CAMBIADO` a culminado, con fecha real y responsable del evento; no utiliza updatedAt como fecha de cierre. Proceso usa apertura real de work item; hito usa `fechaFinReal` canónica. Una fecha sin hora se almacena normalizada al mediodía de Caracas en la columna timestamp; evidencia y API conservan la precisión `dia` y exponen la fecha sin inventar una hora real de finalización. Solo hechos dentro del periodo y no futuros cuentan; cumplimiento tardío dentro del mismo mes se identifica como tal. Un hecho del mes siguiente no rescata retroactivamente la meta.

Las transiciones de proyecto/work item evalúan metas en su misma transacción. La lectura del periodo reconcilia también estados (incluido cierre mensual) con actualizaciones condicionales e historia única; no genera actividad en cada render. Resultado y contexto terminal se conservan. Una reapertura posterior no borra un resultado ya acreditado.

Reasignar o retirar al Especialista cancela las metas de proyecto aún activas de su responsable anterior, con motivo y auditoría. Se evalúan primero los hechos logrados; los resultados previos sobreviven. No se transfiere la meta a la nueva persona. Se cubren asignación central y edición de equipo. FK restrict protege las metas de la eliminación física del proyecto.

Riesgo central: fecha mensual vencida, bloqueo del proceso relevante, pausa formal/stand-by, proyecto retrasado y riesgo operativo calculado con helpers existentes de plazo/tiempo efectivo. No se cambia fecha por pausas. En curso y en riesgo son excluyentes; total incluye resultados y cancelados. No hay porcentajes, tendencias ni ranking.

## UI y consultas

Especialista: `/?vista=objetivos`, selector mensual, seis KPIs, tabs, lista compacta, modal de creación/edición, detalles e historial. Jefatura: `/?vista=seguimiento&subvista=objetivos`, subnavegación real, resumen de equipo, tabla desktop/cards tablet y móvil, selección contextual y asignación. Detalles se cargan al seleccionar. Formularios muestran solo proyectos del destinatario y contexto real; portadas únicamente aprobadas, con placeholder editorial si faltan.

Filtros de periodo/origen/estado/Especialista/proyecto y paginación en servidor. Lectura acotada al periodo, datos relacionados por lotes, resumen único por equipo sin consultas por Especialista. Índices periodo/Especialista, proyecto/estado y creador/idempotencia. Caché incluye identidad, periodo y filtros. Resumen y lista tienen fallos/reintentos independientes. Inicio consume el mismo endpoint de resumen.

Auditoría: creación, ajustes con diff/motivo/actor/fecha, cumplimiento automático, periodo terminado, cancelación y reasignación. Jefatura asigna/ajusta/cancela: notificación dirigida al destinatario, atómica. No spam por render ni aviso diario de riesgo. Historial usa audit_logs, sin tabla duplicada.

## PENDIENTE_VALIDACION_DOCUMENTAL

- Quién realiza el cierre formal del mes: se usa límite calendario de Caracas para consulta, sin inventar un flujo de aprobación.
- Completar manualmente metas generales/cualitativas: no se habilita hasta confirmar quién acredita resultados y con qué evidencia. Se muestran como metas sin comprobación automática.
- Catálogo empresarial definitivo de metas: cuatro tipos técnicos acotados; catálogo de procesos deriva de los work items existentes, no 25 tipos inventados.
- Overrides administrativos de periodos pasados y membresías de equipos: fuera del modelo actual.
- Importación histórica de Excel: requiere resolver identidades, vínculos y evidencia; los originales se conservan intactos.

## Verificación

La evidencia de tests, regresión completa, builds, consultas y QA visual se registra en `docs/reportes/24-objetivos-mensuales.md` y `docs/evidencias/objetivos-mensuales/`.
