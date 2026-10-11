# Jefatura · Proyectos

Proyectos es el explorador del portafolio de Producción: **buscar → filtrar → seleccionar → comprender → profundizar**. Asignaciones y carga conserva la decisión de distribución; Ficha conserva el expediente; Seguimiento conserva la supervisión. La implementación anterior mostraba «Proyectos recibidos» con enlaces directos a Ficha y capacidad del equipo, sin búsqueda, paginación ni quick view.

## Ámbito y fuentes

La ruta continúa siendo `/?vista=proyectos`, dentro del shell de Jefatura, con logo real y sus seis destinos. El listado reutiliza `obtenerDashboardJefatura` con la opción explícita `historico`, sin tablas ni snapshots persistidos adicionales.

- Incluye estados activos `en_proceso`, `retrasado`, `pausado`, `stand_by`, y `culminado` para consulta histórica.
- Exige entrega formal (`notificadoJefatura`) **o** responsable canónico existente, conservando la compatibilidad previa de proyectos asignados legacy. Un proyecto exclusivamente en Comercial/RRPP, sin handoff ni Especialista, queda fuera aunque su diagnóstico esté listo.
- Excluye `retirado`. No existe un estado separado «archivado» en el modelo actual. No se inventa una retención histórica por fecha.
- Especialista actual: assignment de proyecto activo, tipo `especialista`, sin `workItemId` ni `finalizadoEn`; FK como fallback legacy. La misma lectura alimenta Inicio, Asignaciones y el explorador.
- El subtipo CR viene directamente de `fichas_trazabilidad.ingresoServicioSubtipoCrudo`. No se copia al handoff. El nombre utiliza `nombreServicioProyecto`; null se muestra como clasificación pendiente, sin inventar plazo/prioridad.
- Las portadas proceden de `propuestaPortadaUrl` con aprobación registrada. En ausencia de portada aprobada se usa un bloque editorial con icono de libro, sin imágenes generadas.

El alta de proyectos es exclusivamente de Comercial: se retiró el permiso heredado de `jefe_area` en `POST /api/proyectos`. El explorador es de lectura y no ofrece «Nuevo proyecto», editar RRPP ni eliminar. Asignar utiliza únicamente la escritura transaccional existente de Jefatura.

## Resumen, grupos y filtros

| Grupo | Definición |
| --- | --- |
| Total / Todos | Todos los proyectos del ámbito anterior, incluidos culminados. |
| Por asignar | Proyecto activo entregado por RRPP y sin Especialista canónico. Exactamente el criterio de Inicio y Asignaciones. |
| En producción | Especialista actual, estado `en_proceso`/`retrasado` y algún proceso editorial abierto del snapshot central. Las tareas de intake/asignación no cuentan como trabajo editorial. |
| En riesgo | `riesgo.atencion` del helper central: tiempo efectivo, pausas, retraso, bloqueos y vencimientos reales de procesos. Culminados no generan alertas operativas. |
| Express | Solo `evaluarExpressJefatura().estado === confirmado`, vigente y no culminado. Posible Express tiene badge separado y no suma a este contador. |
| Completados | Estado canónico `culminado`, incluso si quedaron tareas abiertas legacy. Nunca se infiere por ausencia de tareas. |

Estos grupos pueden solaparse: un proyecto en producción también puede estar en riesgo y ser Express. Las tarjetas superiores (`counts`) describen el portafolio completo y permanecen estables al buscar. Las pestañas (`tabCounts`) cuentan los resultados tras búsqueda/servicio/estado/Especialista, y el pie muestra el total de la pestaña seleccionada. Así, contador de pestaña y resultado filtrado coinciden. El estado visual principal prioriza culminación, pausa/stand-by, pendiente de asignación, riesgo, producción y asignado sin procesos. Una pausa sin Especialista sigue contando en Por asignar, igual que en Inicio/Asignaciones, y conserva su estado de pausa visible.

La búsqueda tiene debounce de 300 ms, normaliza acentos y busca autor/coautor, título almacenado y código visible; no UUIDs. Los filtros leen servicios del catálogo (incluidos históricos) y Especialistas activos; existe «Sin asignar». Estado y orden se aplican en backend. Urgencia reutiliza vencimiento, atención, Express confirmado y días restantes; otros órdenes: recientes, fecha objetivo y autor A–Z, con desempate estable por código/id.

La página entrega diez registros, máximo veinte solicitado por API. El pie informa `X–Y de Z`. Cambiar filtros reinicia página; seleccionar una fila conserva página y filtros. URL: `grupo`, `q`, `servicio`, `estado`, `especialista`, `orden`, `pagina`, `proyecto`, `detalle`. Recarga y atrás/adelante reconstruyen la vista. Inicio puede enlazar directamente al proyecto seleccionado.

## Tabla y quick view

La tabla contiene proyecto/autor, código, servicio/subtipo, estado, Especialista, objetivo, prioridad y menú de consulta. El click selecciona y cambia el panel; los destinos profundos son acciones explícitas. El registro seleccionado tiene fondo/borde dorado suave. No hay selector editable de Especialista.

El panel carga únicamente el proyecto seleccionado y ofrece cinco pestañas:

| Pestaña | Datos |
| --- | --- |
| Resumen | Estado contextual y causas de riesgo, servicio, prioridad operativa, ingreso, objetivo, plazo central, compresión cuando aplica, páginas, presupuesto y preparación Comercial/RRPP. |
| Información | Contexto de ingreso, unidad, presupuesto, capítulos/páginas, ejecución comercial y meses registrados, fechas estándar/deseada, alianza, observaciones RRPP; solo lectura. |
| Equipo | Assignments activos de proyecto/intervención, responsables FK legacy y correctores externos de intervenciones abiertas. Histórico finalizado no se mezcla con equipo actual. |
| Hitos | Work items reales, pasos/fases asociados, estados y fechas registradas. Handoff y Especialista indican la evidencia disponible. Los procesos no se presentan como una secuencia obligatoria. |
| Actividad | Lazy loading de `historialFicha`: audit logs humanos, actores y nombres de asignación/reasignación, sin JSON, PATCH ni UUIDs visibles. Un fallo permanece local a la pestaña y ofrece reintento. |

Por asignar muestra recomendación del motor existente y **Asignar Especialista**, que abre `AssignmentCandidateDrawer` en Asignaciones, modo candidatos. No hay una segunda implementación de ranking ni escritura. Tras asignar, las invalidaciones de la familia `jefatura` actualizan listado, detalle y contadores; desaparecen recomendación y CTA. Un proyecto asignado en riesgo ofrece **Revisar seguimiento**. Un culminado ofrece consulta y expediente, sin CTA operativo.

Los enlaces **Abrir proyecto 360°** y **Ver ficha completa** usan las vistas existentes y `volver` interno con todos los filtros/selección. Mantienen el shell de Jefatura. Seguimiento acepta el proyecto contextual, muestra sus causas reales, filtra sus registros existentes y permite volver al explorador; no se rediseñó ese módulo.

## Cronograma y Express

La fecha objetivo se resuelve en backend: `fechaFinProyectada` si fue registrada; en su ausencia, fecha deseada para Express confirmado y fecha estándar del evaluador central en otros casos. CR sin clasificación no calcula un objetivo nuevo. React solo formatea fechas.

Plazos centrales existentes: Ghostwriting 180 días, Crudo Capítulo 150, Crudo Tripa 90 provisional, Sello 90 comercial. La contradicción documental de Tripa sigue abierta; esta tarea no redefine los plazos. Compresión usa la resta del helper central y solo se presenta para Express confirmado/posible con compresión positiva.

En el caso de desarrollo Mariana Solís, el ingreso comercial declara Express pero las fechas vigentes no comprimen el estándar; por eso la prioridad operativa permanece Normal. La pestaña Información conserva el valor comercial. No se modificó el proyecto ni se reinterpretó el ingreso como confirmación de Jefatura.

## API, seguridad y rendimiento

- `GET /api/jefatura/proyectos`: `items`, `counts`, `tabCounts`, `filters`, `pagination`; filtros validados con Zod y RBAC `jefe_area`.
- `GET /api/jefatura/proyectos/:id/resumen`: resumen, contexto, equipo e hitos del proyecto autorizado.
- `GET /api/jefatura/proyectos/:id/actividad`: historial humano existente, máximo treinta eventos recientes.
- IDs inválidos: 400. Sin sesión: 401. Otros roles: 403. Proyecto inexistente o fuera del ámbito: 404 tanto en resumen como en actividad.

El listado ejecuta **ocho lecturas por lotes**: siete del snapshot compartido y una del catálogo, independientemente de tener 1 o 31 proyectos. No hay consultas por fila. El detalle agrega lecturas por lotes solo tras seleccionar; no descarga los nueve formularios de Ficha. TanStack Query incluye filtros/página en la key, familias `jefatura/portafolio`, `jefatura/quick-view`, `jefatura/actividad-proyecto`; actualización periódica de treinta segundos e invalidaciones existentes de asignación.

Limitación deliberada: filtrado y paginación se ejecutan en servidor sobre el snapshot completo en memoria, conservando las reglas existentes para decenas de proyectos. La respuesta al cliente sí es paginada. Un portafolio de miles de proyectos requerirá trasladar estas proyecciones a SQL sin cambiar sus definiciones.

## QA y evidencia

Capturas y resultados: `docs/evidencias/proyectos-jefatura/`. Las capturas raíz usan la API de desarrollo, sin sustituir proyectos por mocks: 7 totales, 1 por asignar, 6 en producción y 6 en riesgo, 0 Express confirmados y 0 culminados en el momento de la revisión. Los números no proceden de la referencia visual.

La primera revisión detectó tipografía pequeña, espacio excesivo del encabezado y acciones del panel fuera del primer vistazo. Se integró la cuenta en el encabezado solo para esta vista, ajustó sidebar a 224 px, tabla/panel aproximadamente 70/30, tipografía, alturas y distribución de resumen. Se consolidaron presupuesto y compresión para evitar tarjetas vacías y mantener los destinos profundos visibles. La segunda revisión se repitió en 1440×900, con comprobación automática del límite inferior de las acciones.

Tablet 768×1024: lista y drawer de 420 px. Móvil 375×812: tarjetas, navegación compacta, panel a pantalla completa, contenido desplazable y acciones fijas. Se verifican selección, pestañas, cierre/Escape, foco, URL, búsqueda vacía, error local de actividad y ausencia de overflow horizontal/errores JS.

Express confirmado, culminado, Crudo Tripa y paginación con más de diez registros se comprueban adicionalmente con API real en **`panhouse_portafolio_qa`**, PostgreSQL local aislado, API 3003 y Vite 5175. Sus fixtures se identifican como QA y no se incorporan al producto ni modifican los proyectos de desarrollo. Las capturas están en `isolated/`. Solo en este entorno se ejecuta la asignación visual y se verifica el retorno sin recargar.

Para repetir QA: instalar Playwright temporalmente en `%TEMP%/panhouse-browser-qa`, ejecutar `scripts/portafolio-qa-session.ts` y `scripts/portafolio-browser-qa.mjs`. El script de sesión solo crea una sesión normal del primer usuario Jefatura activo y guarda el token en TEMP, nunca en Git. `portafolio-isolated-qa.ts` crea/migra únicamente la base local de nombre fijo; el runner aislado exige URL `http://localhost:5175`.

Validación de compilación final: `npm run build` y `npm run typecheck` pasaron tanto en la raíz (backend/shared/tests) como en `frontend/`. Vite conserva su advertencia de bundle principal mayor de 500 kB; el build terminó correctamente. QA de navegador: doce comprobaciones con datos de desarrollo y dieciséis en el entorno aislado; ambos registran cero errores JavaScript. Los servidores temporales 3003/5175 se detuvieron al finalizar la revisión; permanecen activos los servicios principales 3000/5173.

La suite general ejecutó **1.066 pruebas en 57 archivos**. Su primera pasada terminó con 1.061 aprobadas y cinco detecciones en el archivo nuevo: cuatro usaban módulos transformados antes de los últimos cambios (permiso de creación, historial de asignación, estado stand-by y `tabCounts`), y una comparación de actividad distinguía mayúsculas innecesariamente. Se corrigió esa comparación y se repitieron todos los casos del explorador y del alta de proyectos en un proceso nuevo: **33 aprobadas, cero fallos** (23 nuevas y 10 de creación; 101 casos ajenos al filtro omitidos en esta repetición). No se volvió a ejecutar completa la suite de 53 minutos; los restantes 1.043 casos habían pasado en la primera ejecución, y los diez afectados por el cambio de permiso se verificaron de nuevo. No quedan fallos conocidos pendientes.

Comando de repetición: `npx vitest run tests/jefaturaProyectos.test.ts tests/proyectos.routes.test.ts -t 'Explorador de proyectos de Jefatura|POST /api/proyectos(?!/)'`. Entre sus verificaciones están 401/403/404, exclusión pre-handoff, lectura canónica de ownership, ambos subtipos CR, reglas centrales de riesgo/Express, paginación y ocho lecturas con 1/31 proyectos.

## Reporte de entrega A–AF

| Punto | Resultado |
| --- | --- |
| A | Antes: lista «Proyectos recibidos», enlace directo a Ficha y capacidad. |
| B–C | Handoff formal o asignación canónica legacy; activos y culminados incluidos; pre-handoff sin responsable y retirados excluidos. |
| D–E | Seis resúmenes y seis grupos, contadores reales; Express confirmado separado de posible. |
| F–G | Catálogo, estado, Especialista activo/sin asignar, cuatro órdenes y búsqueda con debounce/coautoría. |
| H | Tabla para exploración, menú de consulta, selección dorada; paginación real. |
| I–N | Quick view de cinco pestañas con resumen, información de lectura, equipo vigente, procesos paralelos e historial humano. |
| O–P | Pendiente reutiliza Compare/Asignaciones; asignado muestra coordinador y supervisión según riesgo. |
| Q–S | Express, Crudo y riesgo utilizan helpers centrales; clasificación legacy se muestra incompleta. |
| T | Destinos separados 360/Ficha/Seguimiento, retorno y contexto en URL. |
| U–V | Tres lecturas protegidas, ocho queries por lotes en lista, detalle/actividad bajo demanda. |
| W | Tests nuevos: scope/pre-handoff/handoff, ownership, filtros/búsqueda, producción, Express/riesgo/culminación, ambos CR, legacy, quick view/equipo/hitos/audit, paginación, RBAC/IDOR, bloqueo de alta Jefatura y N+1. |
| X | 1.066 pruebas / 57 archivos en regresión general; repetición final de los casos afectados: 33/33 aprobados, sin fallos pendientes. Detalle de ambas ejecuciones arriba. |
| Y | Builds y typechecks de backend y frontend aprobados; advertencia existente de tamaño de bundle Vite. |
| Z–AB | Dos revisiones desktop y correcciones de shell, tamaño, densidad y visibilidad de acciones; capturas finales y assertions de navegador. |
| AC–AD | Tablet drawer y móvil tarjetas/panel completo, sin desborde horizontal. |
| AE | Sin botón Nuevo proyecto; portadas neutras cuando no existe imagen aprobada; títulos/cifras/fechas reales; menos filas según datos disponibles; presupuesto/compresión compactos. |
| AF | Commit local solicitado: `feat: build jefatura project explorer`; sin push ni `fuentes-negocio/`. |
