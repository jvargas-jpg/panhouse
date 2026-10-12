# Project Command Center · auditoría y arquitectura

**Contraste documental completo.** El usuario indicó que el manual exacto estaba en Descargas. Se leyó íntegro `Proceso de adiestramiento - Especialista editorial (3).docx`, tablas y anexos incluidos, y se conservó una copia local en `fuentes-negocio/` sin incorporarla a Git. SHA256: `c9d2ee6ff5b21fd30b7b513cce390d048adf59042c53144a1cb00b232418af19`. El usuario confirmó que la matriz local sin sufijo es la misma versión que la mencionada como `(1)`. La pausa previa se respeta y queda resuelta mediante esta revisión.

## Fuentes y alcance

Auditoría previa a implementación: HEAD `5d4f2e4`; cambios de Indicadores y datos DEMO ya presentes. No se sustituyen datos históricos ni se importan autores, cobros o objetivos del Excel.

Referencia previa: [Manual del Especialista editorial](https://docs.google.com/document/d/1Q7OZuDMqHjA3jPG7pa2FRWyXhfKbYd87/edit), DOCX original consultado en Drive, 2.700.866 bytes. Matriz local: `Downloads/IA Matriz Proyectos - Panhouse - PED-FOR-002.xlsx`, SHA256 `812480fe35cd87d83858e47cd863751697eafbc84e6c1611eca0ad57e4b95072`. Las 25 hojas, incluidas ocultas, encabezados, fórmulas, instrucciones y formatos se registran en `docs/auditoria/command-center-matriz-ia.json`.

BDD-IA tiene 56 columnas de contenido, 86 autores y 998 filas formateadas; las filas vacías con controles no son proyectos. Culminados, Pausados y Retirados son estados/carteras, no nuevos modelos. Las hojas mensuales contienen compromisos de paquete final y cumplimiento, no porcentajes de avance.

## Hallazgos y decisiones

1. El porcentaje del detalle anterior era `pestañaSeleccionada / 10`. Se elimina para Especialista/Jefatura, junto con la simulación de fases completadas al navegar.
2. La Ficha Viva ya reúne nueve áreas, equipo, permisos por campo, fuentes y actividad. Se integra su expediente existente en el shell; no se reconstruye una segunda ficha.
3. `project_assignments` vigente prevalece sobre los FK de compatibilidad. Asignaciones de intervención conservan su alcance. El Command Center no ofrece la antigua asignación genérica de todos los roles.
4. `fases`, `pasos` y `servicio_fases` están vacíos en la base local auditada. No se inventan filas de catálogo ni etapas eternamente pendientes. Los procesos existentes se proyectan desde `work_items` y sus pipelines, con reglas de aplicabilidad centrales para consultas de procesos aún no iniciados. Si existe configuración activa, se consulta como fuente adicional.
5. Riesgo, Express, plazos y pausas reutilizan `obtenerDashboardJefatura` acotado al proyecto. No se copian fórmulas a React. La lectura no modifica fechas o estados.
6. No existe modelo nativo de objetivos mensuales. No se crea una tabla especulativa ni una tarjeta vacía. La sustitución del seguimiento mensual de compromisos del Excel sigue siendo una brecha explícita.
7. Pagos registrados y contrato son hechos administrativos; no equivalen automáticamente a solvencia confirmada. La lectura administrativa no convierte las seis casillas legacy en un contrato de seis cuotas. No se habilita carga final por inferencia del Command Center.
8. La auditoría encontró ausencia de intervención digital en F1. Se añade el work item idempotente `soporte_digital/activacion_amazon` al handoff real de primera validación, con notificación a Soporte Digital; su fecha de activación nativa completa únicamente este trabajo. No autoriza publicación o paquete final. Sin backfill automático de proyectos históricos.
9. La columna de descripción del Excel propone borrar el comentario anterior. Aquí el avance se registra como evento inmutable, nunca sobrescribe la historia.

## Manual → workflow nativo

| Fase / trabajo | Fuente y disparador | Responsable | Plazo / entregable / gate |
|---|---|---|---|
| Ingreso y primer contacto | Comercial → intake RRPP → Jefatura → asignación vigente | Comercial, RRPP, Jefatura, Especialista | Contacto en 24 h según Manual; no se inventa fecha de contacto ausente. Diagnóstico, reunión y minuta |
| Extracción y creación | Edición, capítulos, solicitud/asignación de editor | Jefe de Edición asigna; Editor ejecuta; Especialista coordina | Extracción solo EF. Entrega y feedback nativos; referencia 3 días hábiles por capítulo/media tripa, 5 días feedback tripa |
| Corrección | Intervenciones repetibles, solicitud y asignación | Especialista coordina, Corrector ejecuta | Tripa 120 h continuas; preliminares/cubierta 12 h nativas. Tripa con más de 120 páginas pasa por Decisiones, no botón de aprobación local |
| Dirección creativa | Solicitud tras feedback tripa y títulos; SE desde ingreso | Líder creativo; RRPP aprueba concepto interno; autor aprueba después | Brief, conceptos, recursos; no suplanta RRPP |
| Diseño | Solicitudes, muestras, versiones y revisión interna de cubierta | Diseñador, Líder creativo, Jefe de Edición según acción | Muestra >=3 capítulos. Diagrama desde corrección entregada y aprobación Edición. Entregables URL/versiones |
| Calidad | Handoff diseño → F1; devoluciones → nuevas versiones/rondas; F2/F3 | Soporte editorial revisa; Especialista coordina autor | Deadline explícito nativo. Referencias Manual de 1 día, 10 días de fase, 4 de revisión final y 5 de paquete no se mezclan |
| Paquete final / publicación | Tripa y cubierta aprobadas, documentación y confirmación administrativa | Soporte Digital, RRPP, Cobranzas | Pruebas pueden preceder solvencia; publicación final exige flujo/gate vigente, no deducción por saldo |
| Amazon paralelo | Manual prescribe activación desde primera validación | Soporte Digital y Especialista | Work item desde handoff F1; cierre por fecha nativa de activación. Separado del paquete final |
| Lanzamiento | Capítulo 4 enviado a feedback EF/CR Capítulo; feedback tripa completa CR Tripa; asignación diseño SE | RRPP | `rrppLanzamientoGate`, planificación nativa creada idempotentemente |
| Impresión / Distribución | Interés comercial y registros de sus áreas | Impresión / Distribución | Opcionales; ausencia de solicitud no se interpreta como retraso |

Contradicciones: Manual declara CR Tripa 150 días; regla vigente provisional 90 se conserva. SE tiene referencia comercial 90 e interna 60. Excel contiene ambas variantes y excepciones manuales por fila; no se importan. GAP Excel = hoy−objetivo (positivo atrasado); margen nativo = plazo−tiempo efectivo (positivo restante). Se etiqueta **margen de plazo**, sin invertir el motor. Colores blanco/verde del autor indican solvencia en el Manual, no avance editorial. Las barras de pagos no son barras de progreso del libro.

## Arquitectura, permisos y navegación

Un contrato compartido y un GET acotado al UUID del proyecto. Acceso exclusivo Especialista/Jefatura, comprobación de asignación vigente antes de consultar detalles. Equipo, procesos, fechas y administración comunes; acciones adaptadas al rol. Escritura de avance: Especialista asignado, proyecto activo, auditoría en transacción. Jefatura supervisa y accede a sus módulos de asignaciones, seguimiento y decisiones; no ejecuta corrector, editor o RRPP.

Shell compacto: navegación global del rol, una identidad de proyecto y cinco rutas: Resumen, Operación, Equipo, Ficha y Actividad. `volver` conserva filtros y se valida como ruta interna. Hashes anteriores abren el proceso correspondiente; `ficha-trazabilidad` se adapta a la Ficha integrada para estos dos roles. Otros espacios mantienen sus permisos originales.

Operación muestra procesos paralelos y sus intervenciones reales, fechas, responsable, gate y decisiones. Al seleccionar uno se carga únicamente su formulario nativo. Calidad mantiene versiones/rondas y feedback; no se reemplaza por un estado plano. Ficha conserva su editor documental, catálogo cerrado de campos y `<dialog>` accesible.

Consultas por lotes: resumen ligero de Ficha existente + snapshot central acotado + lote de work items/asignaciones y configuración. Sin consulta por tarjeta. Expediente, actividad completa y formularios operativos son diferidos. Caché incorpora usuario/rol y UUID. Invalidación por proyecto tras mutaciones y de Inicio del usuario activo; no refresca carteras ajenas. Historial paginado por fecha+UUID estable; errores secundarios visibles y reintentables.

## Matriz → PanHouse

Las columnas siguientes se mapean individualmente. Todo contenido histórico permanece en la fuente; la migración en esta entrega es de funcionalidad de consulta y coordinación, no importación de Excel.


| Columna | Campo Excel | Fuente canónica / brecha | Dueño / edición | Vista | Migración |
|---|---|---|---|---|---|
| A | Autores | autores + proyectos_autores | Comercial | Ficha / identidad | Preservar fuente, sin importación |
| B | Ficha de trazabilidad | Ficha Viva + documentos URL | Cada propietario documental | Ficha | Preservar fuente, sin importación |
| C | Colecciones | coleccionPanhouse / catalogo | RRPP | Ficha | Preservar fuente, sin importación |
| D | Unidad | proyectos.unidadId | Comercial | Resumen | Preservar fuente, sin importación |
| E | Relevancia del autor | autores.categoria | Comercial | Ficha | Preservar fuente, sin importación |
| F | 1er Proyecto | proyectos_autores, otros proyectos del autor | Derivado, sin edición | Ficha; no tres slots duplicados | Preservar fuente, sin importación |
| G | 2do Proyecto | proyectos_autores, otros proyectos del autor | Derivado, sin edición | Ficha; no tres slots duplicados | Preservar fuente, sin importación |
| H | 3er Proyecto | proyectos_autores, otros proyectos del autor | Derivado, sin edición | Ficha; no tres slots duplicados | Preservar fuente, sin importación |
| I | Tipo de Servicio | servicios + ingresoServicioSubtipoCrudo | Comercial / RRPP | Identidad | Preservar fuente, sin importación |
| J | Fecha de inicio | fechaRealInicio / fechaProgramadaInicio / ingresoFechaIngreso, etiquetadas | Propietario nativo | Resumen / Ficha | Preservar fuente, sin importación |
| K | Fecha de fin proyectada | cronograma y proyección centrales | Derivado | Resumen | Preservar fuente, sin importación |
| L | GAP | riesgo y duración efectiva centrales; signos y pausas documentados | Derivado | Resumen | Preservar fuente, sin importación |
| M | GAP 2 | riesgo y duración efectiva centrales; signos y pausas documentados | Derivado | Resumen | Preservar fuente, sin importación |
| N | Dias de ejecución | riesgo y duración efectiva centrales; signos y pausas documentados | Derivado | Resumen | Preservar fuente, sin importación |
| O | Fecha fin deseada | fechaDeseadaAutor / ficha.fechaDeseadaCulminacion | RRPP y regla vigente | Resumen / Ficha | Preservar fuente, sin importación |
| P | Jefe del área | jefeAreaId | Jefatura | Equipo | Preservar fuente, sin importación |
| Q | Coordinación | project_assignments especialista vigente, FK fallback | Jefatura | Equipo | Preservar fuente, sin importación |
| R | Editor | asignación Edición | Jefe de Edición | Equipo / Operación | Preservar fuente, sin importación |
| S | Corrector | correcciones + project_assignments de intervención | Flujo Correcci?n | Equipo / Operación | Preservar fuente, sin importación |
| T | Diseñador gráfico | disenos + project_assignments | Flujo Diseño | Equipo / Operación | Preservar fuente, sin importación |
| U | 1. Proceso de ingreso | intake_rrpp + handoff y fechas documentales | RRPP | Actividad / Ficha | Preservar fuente, sin importación |
| V | Fecha | intake_rrpp + handoff y fechas documentales | RRPP | Actividad / Ficha | Preservar fuente, sin importación |
| W | 2. Extracción de contenido | edicion + capitulos + documentos | Edición / Especialista según acción | Operación / Ficha | Preservar fuente, sin importación |
| X | Fecha | edicion + capitulos + documentos | Edición / Especialista según acción | Operación / Ficha | Preservar fuente, sin importación |
| Y | 3. Creación de Contenido | edicion + capitulos + documentos | Edición / Especialista según acción | Operación / Ficha | Preservar fuente, sin importación |
| Z | Fecha | edicion + capitulos + documentos | Edición / Especialista según acción | Operación / Ficha | Preservar fuente, sin importación |
| AA | 4. Feedback de tripa completa | fechaFeedbackTripa y evento nativo | Especialista | Operación / Actividad | Preservar fuente, sin importación |
| AB | Fecha | fechaFeedbackTripa y evento nativo | Especialista | Operación / Actividad | Preservar fuente, sin importación |
| AC | 4.1 Asignación corrección Final | correcciones.assignment y work_items | Flujo Correcci?n | Operación | Preservar fuente, sin importación |
| AD | Fecha | correcciones.assignment y work_items | Flujo Correcci?n | Operación | Preservar fuente, sin importación |
| AE | Diseño creativo | direcciones_creativas + reuniones | Líder creativo / Especialista según acción | Operación | Preservar fuente, sin importación |
| AF | Fecha | direcciones_creativas + reuniones | Líder creativo / Especialista según acción | Operación | Preservar fuente, sin importación |
| AG | 5.  Asignación de diseño | disenos y asignaciones | Flujo Diseño | Operación | Preservar fuente, sin importación |
| AH | Fecha | disenos y asignaciones | Flujo Diseño | Operación | Preservar fuente, sin importación |
| AI | 6.  Tripa Diagramada | diseno_versiones entrega | Diseñador | Operación | Preservar fuente, sin importación |
| AJ | Fecha | diseno_versiones entrega | Diseñador | Operación | Preservar fuente, sin importación |
| AK | 7.  Aprobación final | ficha_calidad_fases y aprobaciones/versiones | Calidad / autor coordinado | Operación | Preservar fuente, sin importación |
| AL | Fecha | ficha_calidad_fases y aprobaciones/versiones | Calidad / autor coordinado | Operación | Preservar fuente, sin importación |
| AM | Estatus | proyectos.estado | Flujo macro autorizado | Resumen | Preservar fuente, sin importación |
| AN | Descripción | audit_logs avance inmutable | Especialista asignado | Actividad | Preservar fuente, sin importación |
| AO | Tipo de Retraso | pausas.causa y anotaciones documentales; no causa inferida | Actor nativo | Ficha / Actividad | Preservar fuente, sin importación |
| AP | ¿Contrato Firmado? | contratoFirmado | Comercial, lectura editorial | Administración | Preservar fuente, sin importación |
| AQ | Pago Cuota 1 | cuotas legacy en fuente; pagos nativos flexibles | Comercial/Cobranzas, lectura editorial | Administración; sin importar casillas | Preservar fuente, sin importación |
| AR | Pago Cuota 2 | cuotas legacy en fuente; pagos nativos flexibles | Comercial/Cobranzas, lectura editorial | Administración; sin importar casillas | Preservar fuente, sin importación |
| AS | Pago Cuota 3 | cuotas legacy en fuente; pagos nativos flexibles | Comercial/Cobranzas, lectura editorial | Administración; sin importar casillas | Preservar fuente, sin importación |
| AT | Pago Cuota 4 | cuotas legacy en fuente; pagos nativos flexibles | Comercial/Cobranzas, lectura editorial | Administración; sin importar casillas | Preservar fuente, sin importación |
| AU | Pago Cuota 5 | cuotas legacy en fuente; pagos nativos flexibles | Comercial/Cobranzas, lectura editorial | Administración; sin importar casillas | Preservar fuente, sin importación |
| AV | Pago Cuota 6 | cuotas legacy en fuente; pagos nativos flexibles | Comercial/Cobranzas, lectura editorial | Administración; sin importar casillas | Preservar fuente, sin importación |
| AW | Contenido adicional | ficha_documental_datos contenidos adicionales | Propietario del cat?logo | Ficha | Preservar fuente, sin importación |
| AX | Contenido adicional | ficha_documental_datos contenidos adicionales | Propietario del cat?logo | Ficha | Preservar fuente, sin importación |
| AY | Contenido adicional | ficha_documental_datos contenidos adicionales | Propietario del cat?logo | Ficha | Preservar fuente, sin importación |
| AZ | Estatus contenido adicional | ficha_documental_datos contenidos adicionales | Propietario del cat?logo | Ficha | Preservar fuente, sin importación |
| BA | Estatus con Cobranzas | estado administrativo confirmado en fuente documental; no solvencia inferida | Comercial/Cobranzas | Administración | Preservar fuente, sin importación |
| BB | Cumplimiento de Pago | ratio y sparkline de casillas Excel, sin equivalente editorial | Derivado financiero, no avance | Administración; no se duplica porcentaje | Preservar fuente, sin importación |
| BC | Cumplimiento de Pago | ratio y sparkline de casillas Excel, sin equivalente editorial | Derivado financiero, no avance | Administración; no se duplica porcentaje | Preservar fuente, sin importación |
| BD | Observaciones Administrativas | observaci?n administrativa fuente documental | Comercial/Cobranzas | Ficha | Preservar fuente, sin importación |


## Verificaciones provisionales antes del contraste documental

Los builds de frontend y backend pasaron. El navegador verificó 43 casos en escritorio 1440×900, tablet 768×1024 y móvil 375×812, con login nativo de ambos roles en una base temporal; se conservaron capturas iniciales, correcciones y capturas finales. Se comprobaron enlaces reales desde Seguimiento y Quick View, retorno de filtros, Ficha integrada, Escape/foco y permisos de avance. La base y las credenciales temporales se eliminaron.

El resumen del caso DEMO `1093A0` requirió una petición del navegador y 30 lecturas SQL por lotes. No se ejecutan consultas por tarjeta. El Command Center quedó en un chunk diferido de aproximadamente 21 kB; el chunk principal existente mantiene la advertencia de Vite de más de 500 kB.

Regresión ejecutada: 61 archivos y 1152 pruebas; 1150 pasaron en el primer recorrido. Dos pruebas nuevas se ejecutaron con dependencias cargadas antes de cambios durante esa ejecución. La repetición focalizada, con procesos nuevos y código congelado, pasó 18/18. Se conserva el resultado original y el de repetición; no se presenta esto como una regresión integral final sobre una sola revisión. Esa validación final, el contraste del manual `(3)` y el commit siguen pendientes.
