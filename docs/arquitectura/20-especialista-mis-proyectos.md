# Mis proyectos del Especialista

## Propósito y navegación

La cartera responde qué proyectos están bajo la responsabilidad del Especialista y cómo está cada uno. Una fila representa un proyecto. Inicio prioriza unos pocos proyectos; Mi trabajo enumera acciones de coordinación; Command Center profundiza en un solo proyecto. `/?vista=mis-proyectos` abre la cartera. Gestionar abre `/proyectos/:id` y la primera acción abre su proceso contextual. `volver` conserva búsqueda, filtros, orden y página en la URL.

## Auditoría previa

Se revisaron `git status`, `git diff --stat`, `git diff` y los diez commits recientes antes de modificar código. Había cambios previos en Inicio, indicadores y Command Center, que se conservan. La cartera anterior infería una sola fase desde la ficha, cargaba una ficha por proyecto y carecía de búsqueda/paginación de servidor. Inicio también contenía una lista local alternativa para la misma ruta.

## Fuentes de negocio

Se leyó `fuentes-negocio/Proceso de adiestramiento - Especialista editorial (3).docx`: Jefatura asigna según carga y el Especialista coordina al autor y a las áreas, custodia entregas y trazabilidad. La fuente disponible de Matriz es `../panhouse_antigua/IA Matriz Proyectos - Panhouse - PED-FOR-002.xlsx`; no se encontró la variante con sufijo `(1)`. Su hoja BDD - IA incluye autor, servicio, coordinación, fechas, GAP, días de ejecución y procesos en paralelo. Se consultaron también las hojas de culminados, pausados, retirados y objetivos. No se importa ni replica su formato.

| Matriz | Dominio actual |
| --- | --- |
| Autor | proyectos_autores y autor principal de compatibilidad |
| Tipo de servicio | servicios + subtipo de Crudo registrado por RRPP |
| Coordinación | project_assignments de tipo especialista, scope de proyecto |
| Fecha fin proyectada | fechaFinProyectada o planificación/Express central |
| GAP y días de ejecución | riesgo y duración efectiva central, con pausas |
| Estado | enum de proyectos; riesgo y Express son atributos independientes |
| Procesos/entregas | work_items y entidades de cada intervención |
| Objetivos del mes | Sin registro nativo conectado; no se inventan metas |

## Fuente canónica de cartera

`carga.ts` centraliza el dueño vigente. Tiene prioridad la asignación con tipo `especialista`, `work_item_id IS NULL` y `finalizado_en IS NULL`. La FK es compatibilidad únicamente cuando no existe historial de ese scope. Un historial finalizado sin sucesor no resucita una FK vieja. El índice parcial garantiza un dueño activo. `asignarEspecialista` llama a `asignarConHistorial`, actualiza la FK y registra auditoría/notificación en una transacción. La primera asignación inicia Producción; reasignar conserva pausa, retraso y estado.

La cartera usa el mismo snapshot de dominio de Inicio y Jefatura, acotado al usuario autenticado antes de leer entidades relacionadas. No usa creador, último editor ni nombres de Matriz. Los retirados no están en la cartera. Cerrados muestra culminados aún asignados a este Especialista; si hay cierre auditado, también exige que él fuera el responsable al cierre. No pretende ser un archivo de proyectos reasignados a otras personas: esos requieren definir acceso histórico de solo lectura por separado.

## Contrato de consulta

`GET /api/especialistas/cartera` requiere sesión y rol Especialista. Parámetros: `search` (compatibilidad `q`), `tab`, `servicio` (UUID del catálogo), `subtipo`, `estado`, `proceso`, `riesgo`, `orden`, `page`, `pageSize` (10, 20, 50). El usuario se toma exclusivamente de la sesión. La respuesta contiene resumen de cartera activa, contadores de tabs, catálogo real, página de filas y metadatos de paginación. No envía fichas, Activity ni Command Center.

Búsqueda por título, coautores y código, combinación de filtros, orden y paginación se ejecutan en el servidor. El resumen no cambia al buscar: describe la cartera completa. Una página fuera del rango se ajusta a la última disponible. Orden prioritario: acción vencida, riesgo, acción propia, Express confirmado, fecha y desempate estable por ID. Otros órdenes: fecha objetivo, recientes, autor A–Z.

El servidor obtiene hechos por lotes con un número fijo de consultas, sin una query por ficha, proceso ni next action. La evaluación de riesgo/gates exige leer la proyección operativa de la cartera antes de ordenar y paginar; la página enviada al navegador es acotada. Una futura materialización de esa proyección permitiría paginar también su evaluación en SQL sin duplicar reglas. No existe caché de servidor. La interfaz reconsulta al montar, al recuperar foco y periódicamente; conserva datos visibles durante refetch.

## Filtros y modelo de fila

Todos significa cartera activa, incluyendo pausa y Stand-by. Requieren acción exige al menos una acción de `accionesEspecialista`, compartida con Inicio y Command Center: entregas, gates y solicitudes que demandan coordinación propia. Una espera en plazo no se convierte en acción. En riesgo usa `evaluarAtencionJefatura`, nunca una heurística de React. Express exige confirmación vigente de Jefatura. Pausados usa estado real o pausa formal abierta. Por iniciar significa asignado sin fecha real de inicio ni work item operativo registrado; no es un nuevo estado del proyecto. Cerrados es una vista separada.

Cada fila conserva estado macro, servicio/subtipo, procesos abiertos independientes, fecha objetivo canónica, riesgo con causas, Express y una primera acción prioritaria. Máximo dos chips visibles; el resto tiene un desplegable accesible. La espera se explica con hechos de autor, decisiones o responsables de procesos. Sin hechos suficientes se dice «Sin acciones pendientes», sin afirmar que el proyecto está saludable. Objetivo mensual se presenta como dato no disponible; no existe filtro de metas ficticias. No hay porcentajes de avance ni cambios de subtipo desde la cartera.

## RBAC y presentación

`POST /api/proyectos` ya es exclusivo de Comercial. El Especialista no tiene CTA de crear, duplicar, importar, eliminar ni reasignar. Command Center y escrituras reutilizan el control de pertenencia canónico; cambiar projectId no concede acceso. Leer no produce audit logs. Los cambios operativos mantienen la auditoría de sus workflows.

Sidebar compacta de 216 px en esta cartera, con los cinco destinos existentes y «Historias que conectan». Desktop usa tabla semántica de filas compactas, encabezado sticky y cinco indicadores. Tablet y móvil usan cards sin tabla horizontal. Filtros adicionales se abren en un diálogo nativo, con foco contenido, Escape y retorno de foco. Búsqueda y filtros persisten en URL. Estados de carga, error, cartera vacía y búsqueda sin resultados son distintos.

## Verificación

La evidencia y los resultados de pruebas se registran en `docs/reportes/20-especialista-mis-proyectos.md` y `docs/evidencias/especialista-mis-proyectos/`. Las fixtures de QA viven exclusivamente en una base local desechable; nunca se siembran proyectos mock en desarrollo.
