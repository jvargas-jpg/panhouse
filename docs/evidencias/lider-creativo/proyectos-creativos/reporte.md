# Líder Creativo · Fase 3 · Proyectos creativos

Implementado y verificado el 21 de octubre de 2026 sobre `fee98ae`. Portafolio operativo por proyecto con consulta resumida en servidor, detalle bajo demanda y acceso a los workspaces creativos existentes. Sin migraciones, roles nuevos ni cambios de producción en Diseño/RRPP/Especialista.

| Punto | Resultado y evidencia |
|---|---|
| A · Estado previo | Árbol limpio. La vista anterior enumeraba intervenciones desde el dashboard; no era un portafolio independiente. Inicio, Mi trabajo y Solicitudes ya tenían su función propia. |
| B · Modelo encontrado | `proyectos`, `direcciones_creativas`, `work_items`, asignaciones vigentes, propuestas, entregas, Diseños/versiones, auditoría y workspaces Drive. Se revisaron arquitectura/auditoría, manual «Proceso de adiestramiento - Especialista editorial (3).docx» y matriz de Dirección Creativa (19 hojas), además de los comandos reales. |
| C · Modelo reutilizado/ajustado | CTE y mapeo de `creativeInbox` compartidos; proyección por proyecto con identidad raíz estable. Se alinearon el gate de título/subtítulo y la resolución de Especialista vigente. Se preservan tipos y comandos existentes. |
| D · Estados creativos | MEETING, BRIEF, CONCEPTS, RESOURCES, COVER, COMPLETED y BLOCKED, derivados de hechos persistidos. Solo se marca la categoría actual: sin porcentaje, ratio ni etapas pasadas fingidas. |
| E · Esperas | RRPP, AUTHOR, DESIGN, SPECIALIST y dependencia CREATIVE de otro Líder. Conservan contexto sin CTA operativa del usuario. |
| F · Siguiente paso | Texto derivado de la fase y responsable actual, incluyendo ajustes, envío al autor, entrega de Diseño y cierre creativo. |
| G · Summary query | `listCreativeProjects`: una sentencia SQL con representante único `DISTINCT ON(project_id)`, filtros, total, facetas y página. No devuelve arrays de conceptos/timeline por fila. |
| H · Detail query | Una consulta de contexto, una de workspace y, solo si está listo/vigente, una lectura de DESIGN. Carga únicamente al seleccionar. |
| I · Counts | Proyectos distintos. Todos respeta búsqueda/servicio/Especialista/alcance; categorías mantienen acceso al historial. Badges del shell conservan poblaciones de acciones y solicitudes. |
| J · Filtros | Servicio del catálogo, categoría, Especialista y alcance; validados en API y ejecutados en SQL. Cambiar filtro reinicia página/selección. En Chrome: Crudo redujo 27 activos a 2; combinado con Especialista Demo, a 1. |
| K · Búsqueda | Título, coautores y Especialista; parametrizada y literal para `%`, `_` y barra inversa. Debounce de 300 ms. Vacío filtrado y recuperación comprobados. |
| L · Paginación | SQL, 10/25/50 filas, ajuste de página fuera de rango. Chrome mostró 1–10 de 27 y luego 11–20; `page=2` en URL. [Captura](pagination-page2.jpg). |
| M · Orden | Acción del Líder primero; cierre al final; esperas con fecha vigente próxima; actividad y projectId como desempates. Alternativas por actividad/título. Una espera antigua no se convierte en deuda del Líder. |
| N · Especialista | Asignación de proyecto vigente, FK legacy solo sin historial. Una asignación finalizada no restaura una FK obsoleta; test específico. |
| O · Servicio | ID/nombre/código del catálogo y helper canónico para subtipo Crudo. No se copiaron servicios ni números de la referencia. |
| P · Última actividad | Evento real permitido de auditoría con fecha, etiqueta y actor; no se usa updatedAt como actividad inventada. |
| Q · Header | Título y subtítulo de portafolio, shell/logo/cuenta/navegación existentes. Sin crear proyectos, tareas ni solicitudes. |
| R · Tabs | Categorías compactas con cantidades reales. Reunión/Bloqueados aparecen cuando corresponden. Completados es selección explícita. |
| S · Filas | Seis columnas: proyecto, servicio, estado, actividad, siguiente paso y detalle. Una sola fila aunque haya tres work items o varias versiones de cubierta. |
| T · Selección | Selección visible, clic y Enter/Espacio; `selectedProject` en URL. No ejecuta comandos. Filtros y página sobreviven al workspace y su retorno. |
| U · Creative Quick View | Panel lateral en desktop, drawer en tablet, detalle completo en móvil; loading/error/retry separados del listado. [Error local con lista utilizable](detail-local-error.jpg). |
| V · Conceptos | Registros reales y hasta tres previews iniciales; clic abre metadata/feedback/aprobaciones. Archivo secundario. PDF muestra placeholder, sin descarga para preview. [Metadata](concept-metadata.jpg). |
| W · Recursos | Imagen fuente/Freepik y PDF vinculados al concepto aprobado. Vacío normal, sin checklist adicional. Metadata de entrega prevalece si hay aprobaciones históricas múltiples. |
| X · Drive | Root/DESIGN persistidos y contexto READY vigente; sin OAuth, carpetas calculadas, Google por selección ni subida de archivos. Tests cubren ocultar contexto anterior. |
| Y · Timeline | Hasta seis eventos creativos/handoffs de cubierta, scoped por proceso/WI/versión. Excluye pagos y procesos ajenos; no expone payloads. |
| Z · CTAs | IDs reales y rutas locales hacia `CreativeWorkDialog`, compartido con Mi trabajo. Consulta no lleva a Ficha como workspace. Esperas/completados no operan. |
| AA · Brief | Estado y mismo WI canónico comprobados; en Chrome abrió reunión/Brief y volvió conservando selección/filtro. [Workspace](workspace-brief.jpg). |
| AB · Conceptos | 2–3 propuestas según dominio existente, guard de Brief aprobado y ajustes por concepto. Tests cubren feedback/IDs; UI metadata real. |
| AC · RRPP | Revisión previa al primer envío al autor, espera sin CTA. Ajustes regresan al Líder; caso QA y tests. |
| AD · Autor | Comunicación por Especialista; espera sin CTA. Feedback abrió el concepto exacto para ajustar, sin mutarlo durante el recorrido. [Workspace](workspace-author-feedback.jpg). |
| AE · Recursos | Concepto aprobado, formulario real de imagen/PDF; abierto y cerrado sin alterar el caso. [Workspace](workspace-resources.jpg). |
| AF · Diseño | Proyecto permanece en COVER cuando Diseño trabaja o recibe ajustes. Cero CTAs primarias del Líder. [Espera](waiting-design.jpg). |
| AG · Cubierta | Chrome rechazó V1 con feedback; Diseño recibió el trabajo; helper existente entregó V2; Chrome abrió V2 y aprobó. Misma raíz/proyecto/Diseño y fila única. [Devuelta](cover-returned-to-design.jpg), [V2](cover-v2-ready.jpg), [transición](cover-v2-transition.json). |
| AH · Cierre creativo | Después de aprobar V2: COMPLETED y sin acción. Los diez proyectos editoriales QA siguen `en_proceso`; Calidad conserva su decisión propia. [Completado](creative-completed.jpg), [verificación posterior](post-cover-qa.json). |
| AI · RBAC | Rutas exclusivas de `lider_creativo`, usuario de sesión y asignación vigente. Sin ampliar permisos de otros roles. Comandos revalidan ownership/gates en transacción. |
| AJ · IDOR | Proyecto/proceso/concepto y proceso ajeno dentro de proyecto propio comprobados. En revisión propia con fuente de otro Líder solo se expone concepto aprobado, sin comandos del proceso fuente. |
| AK · Rendimiento/N+1 | Test instrumentado: una sentencia de listado con 1 y 16 proyectos. Detalle constante 2–3 lecturas, sin bucle de aplicación por fila ni Google. No se realizó benchmark de 10 000 proyectos. |
| AL · Pruebas nuevas | 18 backend y 9 frontend. Backend cubre dominio, bucles, gates, asignación, búsqueda, facetas, paginación, orden, auditoría, Drive, IDOR y coste de consultas. Frontend cubre presentación, categorías, ausencia de progreso ficticio, esperas, previews, estados independientes y rutas. Interacción/responsive se verificaron además en Chrome. |
| AM · Totales | **77 archivos, 1467 tests aprobados**. Incremento de 27 tests sobre la base de 1440. Suite creativa enfocada: 2 archivos, 56 tests. |
| AN · Regresión completa | `npm test`, una ejecución sin otras suites concurrentes, exit 0, 449.34 s. [Salida final](regression-summary.txt), [checks](checks.json). |
| AO · Build/typecheck | Backend `npm run typecheck` y `npm run build`; frontend ambos comandos: exit 0. Vite conserva aviso de chunk mayor de 500 kB; build exitoso (8.30 s). |
| AP · QA inicial | Diez proyectos nuevos explícitamente QA, identidades/catálogos existentes, enlaces `example.test`; ningún proyecto previo modificado, sin Google. [Casos](qa-fixtures.json), [dominio inicial](initial-domain-qa.json), [desktop inicial](inicial-1440.jpg). |
| AQ · Correcciones visuales | Comparación con referencia: se mantuvo tabla/panel y densidad editorial; se aumentó legibilidad del texto desktop, se acortó el selector móvil a «Estado» y se amplió el cierre del drawer a 40 px. Portadas ausentes usan placeholder, sin imágenes inventadas. |
| AR · Desktop final | 1440×900, seis columnas, panel de 308 px, más de siete filas visibles en la composición evaluada. [Final visual](final-1440.jpg) antes del ciclo funcional (9 activos); [estado posterior](final-after-cover-1440.jpg) con 8 activos/2 completados. |
| AS · Tablet | 768×1024, sin desbordamiento horizontal; detalle en drawer. [Lista](tablet-768.jpg), [detalle](tablet-detail-768.jpg). |
| AT · Mobile | 375×812, tarjetas y detalle completo, sin desbordamiento horizontal. [Antes](mobile-inicial-375.jpg), [final](mobile-final-375.jpg), [detalle](mobile-detail-375.jpg). |
| AU · Límites conocidos | Indicadores sigue sin ruta propia en el repositorio previo; no se añadió analítica ni enlace vacío. Sin validación remota/subida de archivos ni benchmark masivo. El cierre conceptual por recursos y regreso a COVER al activarse Diseño respeta el dominio existente. No quedan pendientes del portafolio dentro del alcance solicitado. |
| AV · Diff | [git diff --stat del contenido preparado](diff-stat.txt). Incluye implementación, tests, scripts QA, arquitectura y evidencias. |
| AW · Estado Git | [Estado previo al commit](git-status-before-commit.txt). Solo cambios de esta fase; secretos/logs/builds fuera del índice. La limpieza posterior se verifica al entregar. |
| AX · Commit | Commit local con asunto `feat(creative): add scoped project portfolio and quick view`. El hash y estado final se comunican en la entrega, una vez creado. Sin push. |

Los fixtures no forman parte de los datos del producto. Sus scripts tienen guard estricto de desarrollo local `/panhouse`, no crean credenciales y dejan datos privados de sesión fuera de Git. `creative-portfolio-verify-qa.ts --after-cover` es una comprobación de solo lectura; `creative-portfolio-advance-qa.ts --cover-v2` afecta únicamente el caso QA de cubierta registrado.

Arquitectura y decisiones: [27-lider-creativo.md](../../../arquitectura/27-lider-creativo.md). Ver también [QA visual/funcional](visual-functional-qa.json), [filtro vacío](empty-filter.jpg) y [filtros combinados](catalogue-filters.jpg).
