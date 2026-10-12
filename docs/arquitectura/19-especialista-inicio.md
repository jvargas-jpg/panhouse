# Especialista · Inicio: auditoría previa

Estado: **contraste documental completo; implementación en curso**. Se encontró y leyó íntegro el archivo exacto `(3)` en Descargas y se conservó una copia local en `fuentes-negocio/` (ignorada por Git). SHA256: `c9d2ee6ff5b21fd30b7b513cce390d048adf59042c53144a1cb00b232418af19`. Se inspeccionó todo el contenido OOXML, incluidas las tablas y los anexos; no contiene imágenes incrustadas. La condición previa del usuario queda satisfecha.

## Solicitud y estado del repositorio

La imagen recibida define composición y jerarquía; sus nombres, cifras, tendencias, estados y porcentajes de capacidad no son datos de PanHouse. El Inicio solicitado debe priorizar acciones del Especialista y enlazar al contexto real del Project Command Center.

Se ejecutaron `git status`, `git diff --stat`, `git diff` y `git log --oneline -n 10`. HEAD: `5d4f2e4`. Existen cambios previos sin commit de Indicadores de Jefatura, escenarios DEMO y Command Center provisional. Se conservan. No se mezclará un commit definitivo de esas funciones con esta auditoría mientras falte el manual.

## Pantalla, shell y navegación actuales

| Pieza | Código actual | Hallazgo |
|---|---|---|
| Entrada por rol | `frontend/src/HomePage.tsx` | Especialista abre `MisProyectosPage`, no un Inicio ejecutivo |
| Pantalla | `frontend/src/proyectos/MisProyectosPage.tsx` | Kanban de cuatro columnas, clasificación por campos de Ficha; cada libro cae en una sola columna |
| Métricas | `frontend/src/proyectos/MetricasEspecialista.tsx` | Agregados en React y fase inferida única; no debe ser la nueva Home |
| Navegación | `frontend/src/layout/RoleProjectNavigation.tsx` | Dos enlaces: Tablero Kanban y Métricas de Producción; faltan los cinco destinos solicitados |
| Shell | `frontend/src/layout/CrmSidebarLayout.tsx` | Reutilizable, ancho compacto 224 px, logo y footer compartidos, breakpoint `lg` |
| Topbar | `frontend/src/layout/AppLayout.tsx` y `TopBar.tsx` | Una cuenta y una campana existentes; evitar duplicarlos al integrar el header |
| Detalle | `ProyectoDetallePage` → `ProyectoCommandCenterPage` | Cinco vistas y selección de proceso en URL; todavía provisional por el contraste documental pendiente |
| Queries | `['proyectos','mios']`, `['ficha',id]` | Una solicitud de lista más una ficha por proyecto |
| API | `GET /api/proyectos/mios` | Ámbito en servidor por asignación vigente y estado activo |

El problema de rendimiento tiene dos niveles: `useQueries(proyectos.map(...))` añade una petición HTTP por ficha; `listarProyectosConRiesgo` llama `mapearFilaConRiesgo` por proyecto y este vuelve a consultar plazo y pausas. Por tanto, sustituir solo las peticiones de Ficha no elimina el N+1 SQL.

Medición de lectura sobre la cuenta DEMO: la lista de 15 proyectos activos ejecutó 32 consultas SQL; el Kanban solicita además 15 fichas por HTTP. La carga calculada por el helper nativo fue 18 puntos, sin capacidad máxima o porcentaje. Estos valores documentan el estado actual y no son constantes propuestas para la interfaz.

El Kanban actual presupone secuencia al usar la presencia de Diseño/Corrección para elegir una fase única. El nuevo Inicio no debe reproducir esa clasificación: mostrará procesos paralelos independientes. La eliminación previa de las barras porcentuales se conserva.

## Fuentes de cada bloque

| Bloque | Fuente existente | Condición que debe conservarse / contraste pendiente |
|---|---|---|
| Proyectos activos | `carga.ts`, `project_assignments`, `proyectos.estado` | Asignación vigente de proyecto prevalece sobre FK; estados activos: en_proceso, retrasado, stand_by y pausado |
| Requieren tu acción | Work items y hechos de Edición, Corrección, Creativa, Diseño, Calidad y Decisiones | Contar acciones humanas que corresponden al Especialista. Riesgo, espera de terceros y acciones ejecutadas por otro rol son conceptos distintos |
| Próximos vencimientos | `correccionSla.ts`, `seguimientoGeneral.ts`, deadlines nativos | La regla existente de proximidad es 24 h. El plazo de 7 días de la imagen no se adopta automáticamente. Excluir intervenciones entregadas/canceladas y distinguir DATE de timestamp |
| Express activos | `evaluarExpressJefatura` | Solo Express confirmado, separado de posible; sin multiplicador de carga |
| Cerrados este mes | Eventos `PROYECTO_ESTADO_CAMBIADO` a culminado y responsable al cierre | Hay proyección histórica en Indicadores; faltan fechas auditadas en posibles registros legacy. No usar updatedAt ni convertir falta de fecha en un cierre del mes |
| Estado de cartera | `proyectos.estado` | Segmentos mutuamente excluyentes del estado macro; riesgo se presenta aparte. No inventar estado "En revisión" |
| Objetivos del mes | Hojas mensuales de Matriz IA | No existe tabla/API nativa de objetivos; propietario de la definición aún no confirmado. No crear objetivos, cumplimiento o porcentajes desde cifras de la imagen |
| Actividad reciente | `audit_logs`, humanización de Ficha Viva | Solo proyectos accesibles; orden fecha+UUID estable; nunca payloads técnicos. No usar audit_logs para el estado actual |
| Solicitudes abiertas | Entidades operativas y sus work items | Petición formal con destino, estado y fecha; no notificaciones ni mensajes. Espera de autor no se convierte en solicitud de otro owner |
| Proyectos recientes | Proyecto + coautores + servicio/subtipo + procesos + pausas | Lista limitada en Home y paginación en la cartera completa. Títulos definitivos tienen prioridad sobre el título legacy |
| Carga actual | `calcularCarga` / `obtenerCargaEspecialista` | Pesos del catálogo, asignación vigente, incluye pausados/stand-by. No hay capacidad máxima formal; omitir porcentaje y barra de capacidad |
| GAP / margen | Motor central de duración efectiva y riesgo | GAP del Excel = hoy−objetivo; margen interno nativo = plazo−tiempo efectivo. No mezclar signos ni poner la fórmula en React |

## Acciones: auditoría de ownership

La atención provisional del Command Center no es un agregado listo para el KPI de Home. Incluye "Esperando feedback" y "Lanzamiento habilitado", además de tareas de ejecución propia. Su contador no se debe reutilizar sin clasificar qué exige una intervención del Especialista y qué informa de una espera.

| Hecho | Especialista | Otro responsable / límite |
|---|---|---|
| Falta Editor y existe solicitud/necesidad nativa | Solicita y da seguimiento | Jefe de Edición asigna; no asignación directa en Home |
| Capítulo entregado sin envío al autor | Coordina el envío y registra fecha | Editor entrega el contenido |
| Feedback pendiente | Coordina respuesta; urgencia basada en fecha nativa | El autor responde; falta contrastar cuándo una espera aún en plazo requiere acción propia |
| Corrección entregada o pendiente de asignación | Coordina/evalúa/asigna según flujo vigente | Corrector ejecuta. Tripa >120 páginas requiere Decisiones, no aprobación local |
| Títulos ausentes | Completa títulos si el gate creativo lo exige | No presentar la mera existencia de Creativa como acción |
| Versión de Diseño entregada | Coordina revisión y autor según verificaciones nativas | Diseñador ejecuta; cubiertas conservan revisión creativa e interna de Edición |
| Calidad aprobada | Coordina autor y siguiente solicitud según ronda | Soporte editorial revisa; no botón "validar calidad" del Especialista |
| Digital habilitado | Coordina y consulta la solicitud nativa | Soporte Digital registra activación; publicación y paquete final son distintos |
| Lanzamiento habilitado | Coordina con RRPP | RRPP planifica. No convertir una planificación existente en una activación pendiente |
| Información solicitada en Decisiones | Responde si es solicitante autorizado | Jefatura resuelve |

Los triggers nativos de lanzamiento son: capítulo 4 enviado a feedback para EF/CR Capítulo, envío/feedback de tripa completa para CR Tripa y asignación de Diseño para SE. La activación Amazon desde F1 existe en cambios provisionales aún pendientes de contraste. El gate de primer contacto valida asignación, pero no hay intervención/deadline de contacto 24 h: no procede un timer aislado.

## Matriz IA y objetivos

Fuente confirmada por el usuario: `Downloads/IA Matriz Proyectos - Panhouse - PED-FOR-002.xlsx`, igual a la versión mencionada como `(1)`. SHA256 comprobado: `812480fe35cd87d83858e47cd863751697eafbc84e6c1611eca0ad57e4b95072`. Coincide con la auditoría previa de 25 hojas y 56 columnas de BDD-IA, incluidas hojas ocultas y 724 reglas de formato condicional.

Las hojas de objetivos contienen autor, título, especialista, fecha de paquete final, observaciones y cumplimiento; algunas incluyen estado actual. El cumplimiento del Excel no acredita por sí solo cierre nativo de proyecto. No se importan autores, objetivos históricos, casillas de cumplimiento o pagos. El propietario de los compromisos y la fecha canónica de cumplimiento se cruzarán con el manual exacto antes de diseñar una escritura.

## Lectura local verificada

Auditoría de datos del 11 de octubre de 2026, cuenta `especialista.demo@panhouse.test`: 15 proyectos activos por el ámbito canónico (13 en proceso, 1 retrasado, 1 pausado) y 1 culminado. Son un snapshot del sistema y no valores que se incorporarán al código. Se verificaron work items de Edición, Corrección, Creativa, Diseño, Calidad y Lanzamiento. `fases`, `pasos` y `servicio_fases` tienen cero filas; no hay tablas con nombre de objetivos/goal, consistente con la revisión del esquema y helpers.

## Criterios para implementar después del manual

Un agregado por lotes deberá obtener el ámbito desde la sesión, no desde un especialistaId arbitrario del navegador. No sirve llamar al Command Center por cada proyecto: sería otro N+1. Las listas deben poder fallar y reintentarse por bloque sin borrar cartera/KPIs válidos. La caché deberá incorporar identidad para evitar mezclar usuarios.

Los cinco destinos globales solicitados deberán tener contenido funcional y enlaces reales. La Home será la entrada; procesos y formularios permanecen en Command Center. Los enlaces conservarán `volver` y proceso. El bloque mensual deberá distinguir ausencia de objetivos registrados de ausencia del modelo confirmado, sin números inventados.

Después del contraste documental: definir contrato y consultas acotadas; documentar conteos/urgencia; implementar; comparar capturas 1440×900 antes/después; verificar tablet 768×1024 y móvil 375×812; comprobar casos 0/1/15 proyectos, Express/riesgo, solicitudes, objetivos según disponibilidad; ejecutar tests de ámbito, IDOR, unidades de conteo, fechas, no N+1, estados vacíos, errores aislados y navegación; ejecutar regresión sobre una revisión congelada, builds y diff antes de commit.

## Pendientes para cerrar la arquitectura

El manual exacto confirma coordinación integral, recordatorios al autor al vencer el plazo, feedback de capítulos 3 días hábiles y tripa 5, activación Amazon desde F1 y los triggers de Lanzamiento descritos arriba. Las entregas de Editor/Corrector/Diseñador no se presentan como ejecución del Especialista: las acciones son enviar, coordinar, asignar mediante su flujo o responder información. Los proyectos pausados conservan carga; no se inventa un nuevo bloqueo de escritura.

No define quién crea los objetivos mensuales ni una fecha canónica de cumplimiento. Objetivos se ofrece como consulta con explicación de la falta del modelo, sin metas, porcentajes, edición o importación automática. Los cierres del mes proceden únicamente del evento auditado con responsable al cierre. No existe timer de primer contacto estructurado, confirmación formal de solvencia ni capacidad máxima: se omiten esas métricas.

Arquitectura acordada: un snapshot de cartera por lotes con ámbito canónico en SQL, reutilizando los motores de Jefatura para Express/riesgo/pausas/carga, y hechos operativos por lotes para acciones, deadlines y solicitudes. La clasificación de atención se comparte con Command Center. Actividad tiene una consulta independiente para permitir su fallo y reintento sin borrar KPIs. Home y cuatro destinos de consulta usan los mismos datos e identidad; los formularios siguen en Command Center. El horizonte de próximos vencimientos conserva las 24 horas del helper nativo. DATE se compara por día de Caracas, timestamp por instante.

## Implementación y límites operativos

`GET /api/especialistas/inicio` obtiene el especialista exclusivamente de la sesión. `GET /api/especialistas/inicio/actividad` devuelve los últimos 30 hechos auditados de sus proyectos, ordenados por fecha y UUID. No admite un selector de propietario que amplíe el ámbito. Asignación vigente de proyecto prevalece sobre FK antiguo en ambos endpoints. La lectura incluye proyectos culminados propios en la cartera completa; el donut y la carga solo incluyen los cuatro estados activos.

El KPI de acciones cuenta **acciones de coordinación**, no proyectos, tareas del ejecutor, riesgo o notificaciones. Capítulos pendientes de un mismo envío/feedback se agrupan por proyecto. Se muestra feedback como acción al vencer la fecha pautada. Una solicitud de Editor existente espera asignación y no genera un segundo "Solicitar Editor". Diseño entregado deja de ser un vencimiento de ejecución y pasa a revisión/coordinación. Corrección completada y versiones históricas de Calidad no vuelven a aparecer como pendientes.

Las solicitudes muestran intervenciones formales de `work_items` abiertas y los casos de `decisiones`. Un caso humano y su corrección bloqueada conservan identidades y destinatarios distintos; no se sustituyen por mensajes de la campana. Las respuestas a Jefatura usan su ruta nativa de autorización. Las demás filas abren Operación del Command Center en el proceso correspondiente.

Los hechos secundarios se leen con recuperación por bloque. Si falla la lectura de capítulos, acciones y vencimientos muestran error con reintento y sus KPIs son `null`/«—»; cartera, carga y Express permanecen disponibles. Si falla la fuente de cierres, no se sustituye por `updatedAt`. Si falla la cartera canónica, se muestra el error general. La actividad puede fallar y recuperarse de forma independiente. No se ocultan errores tras un cero.

La tabla etiqueta el indicador como **Margen**, conforme al motor nativo, y conserva el signo de días restantes; no lo llama GAP del Excel. Los chips agrupan tipos activos y pueden abrir varias intervenciones del mismo proceso. Las rutas conservan `volver`, búsqueda y estado. La caché incluye usuario/rol; las mutaciones del Command Center invalidan el proyecto y la Home de esa identidad.

Las cinco vistas globales son Inicio, Mis proyectos (tabla filtrable/paginada), Mi trabajo (acciones/vencimientos/actividad), Solicitudes y Objetivos del mes (consulta de la brecha de registro). Métricas de Producción mantiene su URL antigua desde Mis proyectos. El antiguo Kanban no es la entrada de Especialista.

## Verificación visual y funcional

19 pruebas nuevas de Inicio y 18 de Command Center: **37/37** en ejecución dirigida. Inicio pasó **39** comprobaciones de navegador y Command Center **43**, con login real en copia QA, 0/1/15 proyectos, permisos, filtros, retorno, error de actividad/reintento y tres viewports. Capturas y resultados en `docs/evidencias/especialista-inicio/` y `docs/evidencias/project-command-center/`.

Primera captura: cuenta desplazada por una regla global heredada, tarjeta de objetivos demasiado alta, metadatos pequeños y fechas mezcladas en orden UTC/día. Correcciones: cuenta dentro del header, texto mensual de producto breve, tipografía de filas más legible, chips por tipo y orden cronológico por día de Caracas manteniendo precisión de la fuente. Captura final y QA de 1440×900, 768×1024 y 375×812 sin desborde horizontal. Móvil ordena atención, vencimientos, solicitudes, actividad y proyectos.

La regresión integral y compilaciones finales se registran en el informe de entrega. La revisión de código congelada se identifica con `docs/evidencias/especialista-inicio/revision-congelada.json`; se comprueba de nuevo antes de commit.
