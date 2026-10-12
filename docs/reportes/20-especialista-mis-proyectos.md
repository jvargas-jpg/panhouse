# Entrega de Mis proyectos del Especialista

La cartera se implementa en código real en `/?vista=mis-proyectos`. Cada fila es un proyecto asignado, con procesos paralelos, salud operativa y primera acción propia. No hay creación, edición masiva ni porcentajes de avance. La entrega conserva el trabajo previo de Inicio y Command Center.

## Informe solicitado

| Ítem | Resultado |
| --- | --- |
| A · Estado anterior | Kanban de cuatro fases inferidas desde ficha, con una consulta de ficha por proyecto. Inicio contenía además una cartera local alternativa. Había cambios previos sin commit en Inicio, Command Center e indicadores. |
| B · Problemas encontrados | Fase única incompatible con paralelismo, consultas por ficha, filtrado local, regreso sin página persistida, duplicación de cartera y fallback de FK que resucitaba una asignación finalizada. |
| C · Fuente canónica | `carga.ts`: assignment activo de Especialista a nivel de proyecto. FK solo cuando no hay historial; historial finalizado no equivale a asignación activa. |
| D · Nuevo proyecto | No existía en el Kanban inspeccionado. La nueva cartera tampoco presenta crear/importar/duplicar/borrar/reasignar ni selección masiva ficticia. |
| E · RBAC de creación | Se conserva `POST /api/proyectos` exclusivo de Comercial. Se prueba rechazo del Especialista por API, junto con borrado y reasignación. |
| F · Sidebar | 216 px en desktop, cinco destinos: Inicio, Mis proyectos, Mi trabajo, Solicitudes, Objetivos del mes. Footer existente. Navegación compacta en tablet/móvil. |
| G · Summary | Cinco conteos reales: asignados, ejecución, atención, riesgo, Express. Atención cuenta proyectos con acciones, no cantidad de tareas. Sin tendencias inventadas. |
| H · Tabs | Todos activos, requieren acción, en riesgo, Express confirmado, pausados, por iniciar y cerrados. Todos incluye pausa y Stand-by. |
| I · Filters | Título/autor/código, servicio del catálogo, subtipo de Crudo, estado, proceso activo y riesgo. Orden prioritario, fecha, recientes y autor. Filtros adicionales en diálogo/sheet. |
| J · Tabla | HTML semántico, una fila por proyecto, título/autor/código, servicio/subtipo, estado, procesos, fecha, riesgo explicado, primera acción y Gestionar. Sin Activity ni ficha completa. |
| K · Service/subtype | Catálogo de DB. Crudo · Tripa y Crudo · Capítulo se muestran en una celda; no se permite cambiarlos. |
| L · Status | Macro estado preservado: en proceso, retrasado, pausado, Stand-by, culminado/cerrado. Por iniciar es una condición de consulta explícita, no un enum inventado. |
| M · Parallel processes | Work items abiertos e independientes. Máximo dos tipos visibles y desplegable con todas las intervenciones, estado, responsable y fecha. Se prueba Corrección/Creativa/Lanzamiento simultáneos. |
| N · Risk | Proyección central de Jefatura con riesgo y duración efectiva. Causas accesibles por teclado; nunca se decide riesgo en React. |
| O · Express | Atributo booleano de confirmación vigente; posible Express no entra al filtro. Puede coexistir con estado y riesgo. |
| P · Objetivo mes | No hay tabla/owner de compromisos mensuales conectado. Se explica la indisponibilidad y no se inventan KPI, badges ni filtro de metas. |
| Q · Next action | Primera acción prioritaria de `accionesEspecialista`, compartida con Inicio/Command Center. Vencidas primero. Esperas de autor/área/Jefatura se derivan de hechos; una espera en plazo no genera tarea ficticia. |
| R · Command Center | Gestionar abre el centro existente, con Resumen/Operación/Equipo/Ficha/Actividad. Primera acción abre su proceso o respuesta real de decisión. Breadcrumb usa Mis proyectos; el retorno sin origen explícito también apunta a esa cartera. |
| S · Assignment flow | Prueba real de entrega RRPP, Por asignar de Jefatura, asignación A y aparición en cartera sin duplicar entradas. Refetch al montar, recuperar foco y cada 15 segundos. |
| T · Reassignment | A desaparece de activos, B aparece. Assignment previo finalizado y sucesor vigente conservan historial. También se prueba FK desincronizada y scope de work item ajeno. |
| U · Pagination/performance | 10/20/50 por página. Búsqueda, filtros, orden y página en servidor; DTO acotado. Número fijo de consultas en 1 y 15 proyectos, sin una query por fila. Riesgo/gates se evalúan por lotes antes de ordenar y paginar. |
| V · RBAC/IDOR | Usuario exclusivamente de sesión. Selector ajeno no amplía alcance. Command Center, ficha y riesgo rechazan proyecto ajeno. La resolución central también se prueba en SELECT de una sola tabla. |
| W · Tests nuevos | 24 pruebas de backend de cartera y cuatro de estado de URL: scope, FK/historial, assignment/reassignment, handoff, RBAC/IDOR, cierres, retirados, catálogo/subtipo, Express, pausas, por iniciar, procesos, acción, espera, search/sort/pagination, query inválida, error de atención, consultas por lotes y conservación de búsquedas antiguas/filtros/página. |
| X · Total tests | Regresión integral del árbol staged: **1.178/1.178**, 62 archivos, cero fallos. Cuatro pruebas adicionales de URL de frontend: **4/4**. Total verificado para esta entrega: **1.182**. Los 17 tests de indicadores de Jefatura ajenos al commit pasaron en la ejecución previa del árbol de trabajo. |
| Y · Build/typecheck | Compilaciones finales frontend y backend aprobadas tras las correcciones. También pasan ambos typechecks de una copia del árbol staged, sin los archivos ajenos de indicadores. Vite conserva el aviso existente de chunk principal mayor de 500 kB. |
| Z · Desktop primera captura | `desktop-primera.png`, 1440×900. Sidebar 216 px, filas 72 px y siete filas completas. |
| AA · Problemas visuales detectados | Perfil absoluto en el borde superior, scroll vertical de tabs, texto secundario tenue, resumen móvil demasiado alto. QA funcional detectó que Home no reaccionaba a cambios de query string. |
| AB · Correcciones | Perfil dentro del header, overflow vertical de tabs desactivado, contraste mejorado, resumen móvil reducido, `useLocation` en Home, eliminación de cartera local redundante, breadcrumb y cache coherentes. Se corrigió además correlación SQL de Por iniciar. |
| AC · Desktop final | `desktop-final.png`: siete filas completas, header/resumen/filtros visibles, riesgo y procesos reconocibles, cero overflow de página. |
| AD · Tablet | `tablet-final.png`, 768×1024: cards en dos columnas, tabla ocultada, navegación y búsqueda accesibles. Sin overflow. |
| AE · Mobile | `mobile-final.png` y `mobile-filtros.png`, 375×812: cards en una columna, búsqueda y botón Filtros, sheet, Escape y retorno de foco. Sin tabla horizontal. |
| AF · Known gaps | Objetivos mensuales sin modelo nativo; Cerrados no es archivo histórico de proyectos ya reasignados. No se recalibran plazos de catálogo por diferencias del manual. La evaluación de riesgo se pagina tras obtener hechos por lotes en servidor, no mediante una nueva fórmula SQL duplicada. |
| AG · Git status | El commit contiene cartera y las dependencias necesarias de Inicio/Command Center. Se preservan sin incluir los cambios previos de `PanelJefaturaPage`, registro/layout de indicadores, `seguimientoIntervenciones`, script de decisiones y archivos de indicadores/evidencia ajena. El árbol de trabajo conserva esos cambios previos; no se presenta como limpio. |
| AH · Commit | Commit de cierre con título `feat: deliver specialist project portfolio`, tras regresión, compilaciones y revisión de diff. El SHA se informa en el mensaje de entrega y puede consultarse con `git log -1`. |

## Evidencia y autocrítica

`docs/evidencias/especialista-mis-proyectos/` conserva capturas desktop inicial/final, tablet/móvil, procesos paralelos, comparación Mi trabajo, cartera 0/1, error, skeleton y búsqueda sin resultados. El QA usa una base nueva local `panhouse_cartera_qa_20261012`, cuentas temporales y login real. Las credenciales se guardan solo en TEMP y se eliminan junto con la base al terminar.

El navegador registra **33 comprobaciones aprobadas** en `browser-final.json`. Se restauró la simulación de red y el viewport, se cerró la pestaña temporal y se eliminaron la base QA y sus credenciales. La inspección final no registró errores JavaScript. Frontend y backend principales responden HTTP 200. Las cuatro pruebas de URL verifican la búsqueda heredada de Inicio, prioridad de `search`, retorno paginado y limpieza sin perder otros filtros.

Se comprobaron búsqueda por autor sin acento, Crudo Tripa + riesgo, todos los tabs, paginación 10 + página 2, retorno desde Command Center con filtros y orden intactos, cartera vacía, una fila única y estados de carga/error con recuperación. Mi trabajo muestra cuatro acciones, mientras Mis proyectos muestra quince proyectos; no comparten el modelo de lista. La cartera no descarga Activity ni ficha completa.

Los quince criterios de autocrítica se cubren por inspección, pruebas de dominio y QA de navegador: cartera completa, ownership real, creación bloqueada, separación con Mi trabajo, unicidad de filas, paralelismo, ausencia de progreso falso, servicio/subtipo, riesgo central, Express independiente, ausencia de objetivos inventados, primera acción contextual, Command Center, reasignación y tres tamaños de pantalla.

## Fuentes e implementación

La arquitectura, el contrato de consulta, las definiciones de filtros y el mapeo de Matriz IA están en `docs/arquitectura/20-especialista-mis-proyectos.md`. Se revisaron el manual DOCX retenido y la Matriz XLSX disponible en `panhouse_antigua`; no se encontró la variante solicitada con sufijo `(1)`. Se mantuvieron ambos documentos sin cambios.

Los nuevos puntos de entrada son `server/helpers/especialistaCartera.ts`, `server/routes/especialistaCartera.routes.ts`, `shared/especialistaCartera.ts` y `frontend/src/proyectos/MisProyectosPage.tsx`. El helper de asignación central evita revivir FKs antiguas en cartera, carga, acceso e Inicio. Las escrituras siguen en los workflows existentes y la lectura de la cartera no añade auditoría.

## Cierre de regresión

La primera ejecución integral del árbol de trabajo se inició antes de congelar la corrección final del resolver SQL: registró 1.194/1.195 y conservó en memoria la expresión anterior del caso sin JOIN. Se mantiene `regresion-previa-cache.json` como evidencia de ese fallo de validación; no representa el código de cierre.

La consulta corregida se verificó directamente en PostgreSQL y se repitió la regresión completa del código de backend congelado en el árbol staged, con una base independiente. La sincronización de archivos de las fixtures hacía lenta la ejecución en disco; la validación final usó PostgreSQL **16**, igual que el entorno local, con almacenamiento temporal en memoria, transacciones y constraints intactos. `regresion-final-staged.json` registra **1.178 aprobadas, cero fallos** y `regresion-final-status.json` confirma salida 0. Los dos ajustes finales de navegación de frontend no cambian el backend congelado y se verifican mediante navegador/pruebas de URL y compilación.
