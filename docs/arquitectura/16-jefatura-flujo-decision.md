# Jefatura: decidir, comprender y rastrear

Implementación local del 10 de octubre de 2026, sobre `d249fdc`. Se refina el trabajo existente sin reemplazar el resumen del proyecto ni el expediente.

## Flujo y fuentes

`RRPP → Inicio → Asignaciones → panel de decisión → asignación`.

Asignaciones permite decidir con contexto comercial/RRPP de lectura, peso del catálogo, recomendación, comparación y asignación. `/proyectos/:id` conserva el resumen y las fases existentes para comprender el trabajo. `/proyectos/:id/ficha-trazabilidad` conserva el expediente, sus nueve áreas, equipo y actividad.

El título y la fila de Asignaciones abren el mismo `AssignmentCandidateDrawer`. Comparar abre su selección de candidatos; asignar/reasignar utilizan la transacción existente, sus guards, historial, audit, notificación y cierre del work item de asignación. No se creó un algoritmo de ranking ni un endpoint de escritura paralelo.

El contexto se agrega a `compararAsignacionJefatura`, después de comprobar el ámbito del proyecto. Se leen ingreso, cierre proyectado, ejecución comercial, meses Express, subtipo CR, capítulos/páginas, presupuesto, alianza y unidad. La preparación reutiliza los evaluadores existentes. La lista conserva sus siete lecturas masivas; la comparación añade una lectura del contexto seleccionado, sin descargar la Ficha completa ni hacer consultas por fila.

El responsable actual se resuelve como asignación activa de tipo Especialista, ámbito Proyecto, sin finalización; la FK es fallback cuando no existe esa asignación. La misma fuente se aplica a riesgo, detalle, bandeja, acceso del Especialista y resumen de Ficha. El equipo no vuelve a agregar una FK contradictoria cuando hay una asignación vigente de ese rol a nivel Proyecto; las intervenciones mantienen su ámbito.

## Navegación y estado

La selección usa `proyecto` y `decision` en la URL de Asignaciones. Búsqueda, servicio, especialista, orden, tab y página utilizan parámetros `jac*`. Recarga, atrás/adelante y retorno desde Proyecto/Ficha reconstruyen la decisión. `volver` acepta únicamente rutas internas y conserva el contexto; Proyecto transmite ese retorno a Ficha.

La Ficha reutiliza la navegación de Jefatura, RRPP y Comercial. Especialista reutiliza sus enlaces reales Tablero Kanban y Métricas de Producción. Las vistas del proyecto quedan dentro del contenido. Jefatura conserva logo, footer y sus seis destinos; en tablet/móvil se conserva la navegación horizontal del rol.

`Tu gestión` en Jefatura ofrece Asignar Especialista únicamente después del handoff, en un proyecto activo sin responsable. Después de asignar ofrece Supervisar proyecto. El diagnóstico es una consulta del ingreso. Corrección ofrece supervisión solamente con un proceso real, y no ofrece acciones de Corrector a Jefatura. La asignación no inicia automáticamente Edición, Corrección, Diseño ni Lanzamiento.

La revisión visual detectó que el resumen antiguo todavía decía Pendiente Jefatura tras asignar. Ahora muestra Especialista asignado cuando existe el responsable canónico; no se cambió el estado operativo ni el flujo de ingreso.

## Express y permisos

Se auditó en lectura el caso real Mariana Solís. La Ficha comercial contiene ejecución Express y tres meses; el servicio CR tiene subtipo Capítulo. La fecha estándar es 1 de enero de 2027 y la deseada 15 de enero de 2027. El evaluador operativo existente determina Normal porque no hay compresión. El panel muestra ambos hechos y explica la diferencia. No se reinterpretaron los meses comerciales como una confirmación operativa ni se modificaron los datos.

El contexto del panel es de lectura. No se ampliaron guards ni permisos comerciales/RRPP. Existe previamente un guard de `proyecto-perfil` que admite Comercial, RRPP y Jefatura; RRPP tiene el límite específico del subtipo CR. Esta implementación no endurece ni amplía esa política heredada y no debe interpretarse como que todos los campos antiguos son exclusivos de Comercial.

Las invalidaciones reutilizan las familias `jefatura`, `proyectos`, `especialistas`, `proyecto`, `ficha`, `ficha-viva` y `notificaciones`. `proyectos` cubre la bandeja `proyectos/mios`. Después de mutar se actualizan cola, capacidad, detalle y expediente mediante TanStack Query. No se utiliza una recarga completa de página.

## Validación

Se aprobaron **74 casos distintos en seis archivos afectados**, incluidos cinco nuevos. La primera corrida aprobó los otros cuatro archivos y detectó tres fallos en los casos nuevos; se corrigieron y la corrida posterior aprobó los 18 casos de Jefatura y los 13 de alertas. No se repitió toda la suite del repositorio.

- `jefaturaAsignaciones.test.ts`: 18 casos, cinco nuevos.
- `fichaViva.routes.test.ts`: 21 casos.
- `workflowCore.test.ts`: 2 casos.
- `proyectos.test.ts`: 14 casos.
- `assignments.test.ts`: 6 casos.
- `alertas.test.ts`: 13 casos.

Los nuevos casos cubren handoff RRPP real, Inicio/Asignaciones, Ficha pendiente, asignación, detalle, equipo, audit con nombres, historial vigente, notificación, bandeja del Especialista y cierre del work item. También cubren Corrección real con supervisión, estados no asignables, contexto CR/Express sin alterar prioridad y asignación activa contra FK desactualizada, acceso 200/403 y reasignación. Los builds backend y frontend aprobaron TypeScript; Vite conserva el aviso previo de bundle mayor de 500 kB.

QA de navegador en una base PostgreSQL local separada `panhouse_jefatura_preview`, con API 3002 y frontend 5174. En el flujo visual, Semillas del mañana pasó de pendiente a Camila Torres; la cola filtrada pasó de 1/0 a 0/1, Camila de 0 a 3 puntos y la Ficha cambió a supervisión. Luego se confirmó Camila → Mateo; la Ficha mostró únicamente Mateo, el audit conservó ambos movimientos y la bandeja de Mateo incluyó a Nora Castillo. Inicio quedó con cinco pendientes, desde los seis iniciales. Se probaron comparación, destinos separados, retorno, recarga y atrás/adelante. No se detectaron errores de consola en la sesión inspeccionada.

Se inspeccionaron 1440×900, 375×812 y 768×1024. Las vistas de Ficha y panel no presentaron desborde horizontal en móvil/tablet. La primera revisión detectó enlaces secundarios y comparación fuera de vista: los enlaces pasaron al footer fijo y Comparar equipo a la recomendación. Se verificaron el footer, candidatos móviles y confirmación de reasignación. La conexión de una pestaña se perdió; se terminó el flujo en una pestaña nueva, se retiró su emulación y se cerró. Las capturas incluyen antes/después y el estado del responsable.

Los procesos temporales se detuvieron y los datos QA se limpiaron con el guard local del script. Los servidores habituales de desarrollo se conservaron. No hubo escrituras en producción ni reasignaciones de proyectos reales durante el QA.

## Entrega A–AA

| Punto | Resultado verificable |
| --- | --- |
| A. Navegación anterior | El título de Asignaciones abría directamente el expediente; Ficha usaba navegación genérica de Proyectos. |
| B. Causa | La fila contenía un `Link` a `/ficha-trazabilidad`, distinto del drawer existente. |
| C. Selección | Fila/título abren decisión sin abandonar Asignaciones; selección persistida en URL. |
| D. Panel | Drawer reutilizado de 580 px, pantalla completa móvil; estado de carga/error y controles existentes. |
| E. Datos | Autor/código/título/servicio, responsable, estado, contexto comercial y RRPP reales de lectura. |
| F. Express/CR | Ejecución y meses comerciales separados del evaluador operativo; subtipo CR y explicación del caso Mariana. |
| G. Impacto | Peso real del catálogo; proyección sin volver a sumar el proyecto a su responsable actual. |
| H. Recomendación | Ranking existente del backend, nombre destacado, puntos actuales/proyectados y motivos. |
| I. Compare | Mismo panel y candidatos existentes; selección humana con composición, cantidad, Express y riesgo. |
| J. Assign/Reassign | Transacción existente, confirmación anterior → nuevo, validaciones e idempotencia conservadas. |
| K. Ver proyecto | Resumen antiguo en `/proyectos/:id`, shell de Jefatura y retorno contextual. |
| L. Ver ficha | Expediente existente y retorno contextual, independiente del destino Proyecto. |
| M. Shell por rol | Componentes existentes de Jefatura/Comercial/RRPP; Especialista comparte su navegación del home. |
| N. Tu gestión | Pendiente: Asignar; asignado: Supervisar; diagnóstico de consulta. |
| O. Corrección | Acción de supervisión condicionada al proceso real; sin capacidad de actuar como Corrector. |
| P. Equipo | Historial activo canónico; sin duplicar FK contradictoria; ámbitos de intervención conservados. |
| Q. Actualización | Cola, carga, Inicio, resumen, Ficha, equipo y bandeja comprobados después de mutar. |
| R. Invalidations | Familias TanStack compartidas; no reload de página para sincronizar. |
| S. Audit | Nombre de actor y Especialista; reasignación anterior → nuevo legible, sin UUIDs en la presentación. |
| T. Notifications | Notificación al nuevo responsable dentro de la transacción existente, probada por integración. |
| U. Tests nuevos | Cinco integraciones de flujo, estados, contexto, fuente canónica y RBAC/IDOR. |
| V. Total tests | 74 distintos aprobados en seis archivos; no equivale a la suite completa. |
| W. Build/typecheck | Backend y frontend aprobados; aviso de tamaño de bundle conservado. |
| X. QA desktop | Iteraciones 1/2/final, comparación y asignación confirmada en 1440×900. |
| Y. QA Ficha | Antes/después: navegación de Jefatura, Asignar → Supervisar, equipo y audit. |
| Z. QA responsive | 375×812 y 768×1024: Ficha, panel, comparación/confirmación; sin overflow horizontal. |
| AA. Commit | Commit local `feat: refine jefatura assignment decision flow`. Sin push; no incluye `fuentes-negocio/`. |

## Evidencias

Capturas en [`docs/evidencias/decision-jefatura`](../evidencias/decision-jefatura/):

- [Decisión inicial](../evidencias/decision-jefatura/desktop-decision-1.jpg), [segunda iteración](../evidencias/decision-jefatura/desktop-decision-2.jpg), [final](../evidencias/decision-jefatura/desktop-decision-final.jpg).
- [Comparación](../evidencias/decision-jefatura/desktop-comparacion.jpg), [asignación confirmada](../evidencias/decision-jefatura/asignacion-confirmada.jpg).
- [Ficha antes](../evidencias/decision-jefatura/ficha-antes-asignar.jpg), [Ficha después](../evidencias/decision-jefatura/ficha-despues-asignar.jpg), [audit](../evidencias/decision-jefatura/equipo-audit.jpg).
- [Móvil Ficha](../evidencias/decision-jefatura/mobile-ficha.jpg), [decisión](../evidencias/decision-jefatura/mobile-decision.jpg), [comparación](../evidencias/decision-jefatura/mobile-comparacion.jpg).
- [Tablet Ficha](../evidencias/decision-jefatura/tablet-ficha.jpg), [decisión](../evidencias/decision-jefatura/tablet-decision.jpg).
- [Ficha Especialista](../evidencias/decision-jefatura/especialista-ficha.jpg), [resumen con responsable](../evidencias/decision-jefatura/proyecto-responsable.jpg).

## Aclaración consolidada: Crudo, readiness y planificación

Ampliación del mismo flujo, 10 de octubre de 2026. El subtipo permanece en la Ficha canónica; el handoff no lo copia. Se reutiliza `evaluarPreparacionRrpp` y su gate de definición Crudo. Se corrigió Inicio RRPP para que un work item cerrado no convierta un intake incompleto en «Listo para Jefatura».

| Punto | Resultado |
|---|---|
| A. Fuente canónica | `fichasTrazabilidad.ingresoServicioSubtipoCrudo`; valores `Tripa` / `Capítulo`. Todas las lecturas usan esta columna, sin snapshot de Jefatura. |
| B. Propietario | RRPP. Comercial y Jefatura reciben 403 al intentar modificar este campo. |
| C. Readiness existente | Ya existía `server/helpers/preparacionRrpp.ts`. Alimenta progreso, checklist, faltantes, estados y el endpoint formal dentro de su transacción. Se conserva. |
| D. Obligatorios actuales | `matrizDiagnosticoGenerado = true` y `matrizIngresoGenerado = true`; adicionalmente, sólo para CR, subtipo válido. Colección, público, tema, título y demás campos opcionales no bloquean. No se inventó otro catálogo de obligatorios. |
| E. CR sin subtipo | Readiness false, 67% si ambas señales documentales están completas, clasificación en faltantes y handoff directo rechazado con 409. No crea envío ni aparece en la cola de Jefatura. |
| F. Tripa | 90 días operativos **provisionales**. No se cambió a 150 ni se resolvió la contradicción documental. |
| G. Capítulo | 150 días. Ghostwriting usa 180; Sello conserva 90 comerciales y 60 internos para alertas. Los demás servicios leen su configuración real. |
| H. Fecha y Express | `shared/planificacion.ts` centraliza resolver plazo y sumar días UTC. Base: fecha de ingreso canónica, con fecha programada del core como respaldo donde existe. Fecha deseada canónica, con respaldo legacy del core. Posible Express = deseada anterior a estándar; compresión = diferencia de días. La decisión explícita de Jefatura sigue separada y se invalida si cambia el par de fechas. CR sin clasificación no recibe fecha estándar ni un Express inventado. |
| I. Peso real | La auditoría local confirmó `servicios.pesoComplejidad = 3` para CR, aplicado a ambos subtipos. El snapshot y recomendador siguen leyendo el catálogo. |
| J. Pesos y Express | No hay peso por subtipo ni multiplicador Express. El subtipo afecta plazo y Express; pesos distintos requieren definición empresarial explícita. |
| K. Auditoría existente | Seis CR sin clasificación: `BE3B50`, `13C2C0`, `924EE1`, `C7BBE3`, `DA372D`, `72DCCF`. **Cero** enviados formalmente a Jefatura; todos en proceso. No se escribió ningún subtipo ni se modificaron datos históricos. Lectura reproducible: `scripts/audit-crudo-readiness.ts`. Los legacy ya enviados se señalan «LEGACY / DATO INCOMPLETO» y quedan sin plazo calculado. |
| L. Regresiones nuevas | Integraciones de CR incompleto y rechazo directo; work item cerrado sin readiness; Tripa y Capítulo; igualdad entre Ingresos, RRPP Proyectos, Inicio/Asignaciones/contexto Jefatura, Proyecto y Ficha; corrección posterior sin copia y decisión Express obsoleta; legacy incompleto; Sello 90/60; gate rechaza subtipo vacío o desconocido. |
| M. Conflicto pendiente | Manual del Especialista: Tripa 150; formulación operativa actual: Tripa 90. Se mantiene 90 provisional y no se altera `servicios.plazoDias` ni el peso del catálogo. |

`READY` sigue separado de `HANDOFF`: guardar todos los requisitos habilita la acción; sólo la confirmación formal persiste el envío. Las invalidaciones después de guardar RRPP y enviar actualizan las familias RRPP, Jefatura, Proyectos, Ficha y expediente vivo sin reload manual.

La fecha de cierre de la Ficha se deriva al leer; no se migra ni sobrescribe el valor histórico almacenado. Las alertas de CR clasificado usan su plazo; para datos legacy sin clasificación conservan la referencia de riesgo del catálogo sin presentarla como fecha estándar de planificación.

### Validación de esta ampliación

- **219 casos distintos aprobados en 11 archivos afectados**; no equivale a la suite completa. `jefatura` 23, `jefaturaAsignaciones` 18, `rrppProyectos` 46, `fichaViva` 21, `rrppIngresos` 29, `rrppCrudoPlanificacion` 7, `alertas` 13, `cronograma` 9, `preparacionComercial.routes` 4, `rrppDashboard` 27, `gates` 22. Diez casos nuevos: siete integraciones y tres variantes de subtipo inválido.
- Backend y frontend compilan. Vite conserva el aviso previo de chunk principal superior a 500 kB.
- QA en base local desechable `panhouse_jefatura_preview`: CR sin clasificación muestra 67% y un faltante; no permite envío. Guardar Tripa muestra listo y fecha `2026-04-01`, sin envío automático. Guardar Capítulo cambia a `2026-05-31`; confirmar envío registra el handoff. Jefatura recibe Capítulo, 150 días, fecha deseada `2026-04-15`, compresión 46 y peso 3. Proyecto 360 y Ficha muestran el mismo subtipo y cierre. Asignación a Camila: carga 0 → 3, sale de Por asignar. No se operó sobre proyectos reales.
- Panel de decisión y Ficha inspeccionados en 1440×900, 375×812 y 768×1024. Móvil y tablet: ancho de documento igual al viewport, sin overflow horizontal; contexto, fechas y acciones legibles.
- Evidencias de esta ampliación en [`docs/evidencias/crudo-readiness`](../evidencias/crudo-readiness/): [clasificación pendiente](../evidencias/crudo-readiness/rrpp-sin-subtipo.jpg), [Tripa listo](../evidencias/crudo-readiness/rrpp-tripa-listo.jpg), [Capítulo enviado](../evidencias/crudo-readiness/rrpp-capitulo-enviado.jpg), [Inicio Jefatura](../evidencias/crudo-readiness/jefatura-inicio.jpg), [decisión desktop](../evidencias/crudo-readiness/jefatura-decision-desktop.jpg), [móvil](../evidencias/crudo-readiness/jefatura-decision-mobile.jpg), [tablet](../evidencias/crudo-readiness/jefatura-decision-tablet.jpg), [Proyecto 360](../evidencias/crudo-readiness/proyecto-360.jpg), [Ficha desktop](../evidencias/crudo-readiness/ficha-desktop.jpg), [móvil](../evidencias/crudo-readiness/ficha-mobile.jpg), [tablet](../evidencias/crudo-readiness/ficha-tablet.jpg).
- Entrega mediante commit local `feat: align crudo readiness and canonical planning`, sin push y sin incluir `fuentes-negocio/`.
- [Ficha tras asignar](../evidencias/crudo-readiness/ficha-asignada.jpg): Tu gestión cambia a Supervisar, equipo muestra a Camila y la actividad conserva el evento del handoff y la asignación. Consola del navegador sin errores al terminar el flujo. Viewport temporal restaurado y pestaña QA cerrada.
- Datos QA limpiados con el guard del script; puertos temporales 3002/5174 cerrados. Los servidores habituales 3000/5173 permanecen activos. Producción y datos reales no se modificaron.
