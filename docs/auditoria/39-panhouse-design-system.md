# PanHouse: unificación del sistema visual

Fecha: 30 de octubre de 2026. Referencia aprobada: Inicio de Comercial, adjunto por el usuario. Aplicación real: frontend en `localhost:5173` y API local existente. Los cambios permanecen locales, sin commit ni publicación.

## Auditoría inicial y protección del trabajo anterior

Se revisaron `git status`, `git diff --stat`, el diff completo guardado antes de intervenir, los seis commits recientes, el router, HomePage y los shells de todos los roles. HEAD inicial: `00e97b7`. Ya había cambios de Pagos, autoridad de Comercial y monto total del proyecto; se conservaron. La comparación automatizada del diff inicial y final de `server/` y `tests/` confirmó que esos cambios anteriores no fueron alterados por esta tarea.

La aplicación tenía un shell CRM bastante compartido, pero con variantes de ancho, logo y footer, y numerosas excepciones en AppLayout para ocultar la topbar global. Editor, Corrector, Jefe de Edición, Creativo y Soportes añadían sus propias barras de cuenta y menús móviles. Admin tenía un shell independiente, navy verde `#092432`, dorado oscuro `#a9853f`, titulares Georgia y un footer serif. Se encontraron también tipografías serif en paneles internos, CTAs navy o negros, métricas con fondos distintos, un acceso con glassmorphism y el encabezado heredado de proyectos con degradado oscuro.

Antes de la migración se capturaron 65 vistas de referencia de las familias operativas, incluidas las tres resoluciones de Comercial. Este baseline visual es parcial; el aspecto anterior de Admin se auditó directamente en su código. La cobertura final se hizo sobre la aplicación completa disponible, según los reportes indicados abajo.

## Canon y tokens

El canon conserva la topbar blanca, el sidebar navy `#111827`, el asset `/brand/panhouse-logo.webp` a 132 px, el activo dorado suave y las superficies claras de Comercial. Se mantuvieron sus datos, composición, herramientas y espaciado de escritorio. La navegación responsive se mejoró mediante el mismo drawer que utiliza el resto de los roles.

`frontend/src/design-system/tokens.css` centraliza la familia sans de la interfaz, navy, dorado, fondo general, texto, bordes, superficies, colores semánticos, radios, alturas de controles, sombras y overlay. Tailwind toma sus colores de marca de esas variables, incluidas las variantes con opacidad.

La escala principal es título de página de 24 px y títulos de sección de 16 px; las tablas conservan densidad según su función. Las superficies usan radio de 12 px y los controles 8 px. La topbar mide 60 px en todas las experiencias internas y resoluciones. Verde significa éxito; ámbar, espera o atención; rojo, bloqueo/error/vencimiento; azul, información o trabajo activo; gris, neutralidad. Los gráficos pueden conservar colores categóricos para distinguir sus series.

## Base compartida

| Pieza | Responsabilidad |
|---|---|
| `AppFrame` | Topbar y cuenta únicas, contenedor raíz, estado común de navegación móvil. |
| `CrmSidebarLayout` | Sidebar oficial, logo, footer, navegación contextual y contenido con scroll propio. Se retiraron las opciones por rol de ancho/branding. |
| `PanhouseLogo` / `BrandFooter` | Asset oficial y lema de marca. El footer es texto, nunca enlace. |
| `Dialog` | Modal, drawer y navegación; overlay, encabezado, Escape, foco inicial, trampa de Tab y devolución de foco. Respeta operaciones pendientes. |
| `PageHeader` | Título, descripción, contexto opcional y acciones. Admin utiliza este componente. |
| `Button` / patrones comunes | Jerarquía de acción primaria dorada, secundaria blanca, auxiliar y destructiva roja. |
| `StatusBadge` | Semántica compartida para Administración, Editor, Pagos y Ficha Viva; adaptación visual de los estados operativos restantes. |
| `SearchInput` | Búsqueda accesible, icono lineal y limpieza opcional; conserva el debounce de cada consumidor. |
| `DataTable` / `FilterBar` | Estructura visual reutilizada por tablas y filtros de Admin, sin contrato de datos común impuesto. |
| `MetricCard` | Métricas canónicas, utilizadas por Admin; las métricas operativas existentes comparten los mismos tokens y tratamientos. |
| `EmptyState`, `Skeleton`, `Pagination` | Estados vacíos, carga y paginación reutilizados mediante los adaptadores de Admin y Editor. |

`patterns.css` define los componentes compartidos; `role-patterns.css` adapta las clases existentes a esa familia sin reescribir sus contratos funcionales. Los CSS de cada área conservan grids, columnas, densidad y composición. La primera extracción retiró 275 reglas de shell duplicadas, normalizó 103 declaraciones tipográficas y sustituyó 549 declaraciones de la paleta base por tokens. Después se retiraron más reglas residuales de navegación y de modales.

Los componentes `AdminUi`, `EditorUi`, `Modal` de Autores, `PaymentDialog`, `EditorialDrawer` y los formularios de trabajo de Edición/Creativo delegan ahora las piezas comunes. Se retiraron los componentes de menú móvil de Corrector y Soportes y las implementaciones paralelas de Editor, Jefe de Edición y Creativo. Las definiciones de enlaces por rol siguen separadas deliberadamente: no son shells distintos.

La colección de iconos lineales existente `RrppIcon` se reutiliza como biblioteca compartida, también desde Ficha Viva. No se recreó el logo ni se añadió una dependencia de iconos.

## Cambios por experiencia

| Experiencia | Cambios visuales y arquitectura preservada |
|---|---|
| Comercial | Conserva Inicio, Autores, Proyectos, Pagos e Indicadores. Logo/sidebar/topbar extraídos al shell; conserva su dashboard aprobado y sus herramientas. Se revalidaron el alta y la edición del monto total, el registro de pagos y el recálculo. |
| RRPP | Mismo shell y menú responsive; conserva Ingresos, Proyectos, Lanzamientos, Solicitudes e Indicadores, sus filtros y detalle. |
| Jefatura | Navegación unificada, encabezados, acciones y superficies comunes; mantiene asignaciones/carga, candidatos, seguimiento, decisiones e indicadores. |
| Especialista | Mismo shell, controles y títulos; conserva Inicio, cartera, acciones, solicitudes, objetivos y Command Center. |
| Jefe de Edición | Retira topbar, footer y menú propios; mantiene carga, asignaciones, proyectos, seguimiento, solicitudes e indicadores. Corrige el espacio vacío excesivo del grid sin retirar paneles. |
| Editor | Retira la piel serif y la cuenta duplicada. Conserva Inicio, Mi trabajo, Mis proyectos y Mis solicitudes, sus tabs y master-detail. Formularios comparten Dialog. |
| Corrector | Sidebar, cuenta, métricas, título, búsqueda y estados comunes. Conserva bandejas de trabajo/solicitudes y guía operativa. |
| Soporte Editorial / Validador | Misma familia para Calidad, rondas y solicitudes; conserva las bandejas compartidas, criterios y acciones de validación. |
| Líder Creativo | Retira shell y menú alternativos; conserva trabajo, portafolio, conceptos, solicitudes y métricas. El trabajo creativo usa Dialog y CTA dorado. |
| Diseñador | Su bandeja existente se incorpora al shell oficial. Se preservan versiones, feedback, fuentes y entregas. Sus botones y badges utilizan los patrones compartidos. |
| Soporte Digital | Shell y componentes compartidos; conserva preparación, pruebas, cargas y solicitudes. Corrige el filtro de estado comprimido en móvil y mantiene los paneles operativos. |
| Dirección | Conserva el directorio y sus permisos. Adopta logo/footer oficiales, menú móvil, botones dorados y modal compartido. |
| Administración | Migra a AppFrame/CrmSidebarLayout. Conserva sus nueve secciones y Project 360 completo. Reutiliza encabezados, métricas, búsqueda, filtros, tablas, estados, diálogos y paginación. |
| Cobranzas heredado | Shell unificado. Como el servidor ya excluye este rol del circuito de pagos actual, se muestra una explicación en lugar de solicitar datos no autorizados y ofrecer enlaces inoperantes. No se otorgaron permisos ni se cambió la autoridad de Comercial. |
| Acceso y portal del Autor | Acceso sin cristal, halos, degradados ni wordmark improvisado; usa el asset oficial. Portal con topbar de cuenta común y confirmación de portada mediante Dialog. Conserva su navegación orientada al autor. |

Talento Humano reutiliza la pantalla existente de Solicitudes y recibe el mismo shell y los mismos controles. No hay cuentas activas locales de ese rol ni de Autor: sus sesiones reales no pudieron verificarse y no se crearon cuentas de prueba. Impresión y Distribución tienen secciones de proyecto existentes, pero no un Inicio propio implementado; no se inventaron pantallas para esos roles.

## Decisiones especiales para Admin

Se eliminaron el sidebar verde azulado, el dorado marrón como CTA, los titulares Georgia gigantes y el lema serif. “El pulso de PanHouse” conserva su significado y ahora usa la escala de Comercial. Inicio, Pipeline global, Proyectos, Personas y accesos, Actividad y auditoría, Solicitudes e incidencias, Integraciones, Configuración y Salud del sistema siguen disponibles.

Pipeline conserva su matriz y los procesos paralelos; Project 360 mantiene Resumen, Procesos, Equipo, Ficha, Archivos, Solicitudes, Actividad y Auditoría. La búsqueda global conserva su lógica. Las tablas administrativas se convierten en filas legibles también en tablet, evitando palabras y badges quebrados entre columnas comprimidas. No se redujo el conjunto de datos ni se suprimieron herramientas administrativas.

## Detalles, tablas, formularios y responsive

Los master-detail mantienen la lista como navegación principal. Sus paneles usan tipografía sans, tabs compactos, divisores y acciones comunes. Los adaptadores conservan sus comportamientos por dominio; en pantallas pequeñas el detalle se presenta como drawer o panel completo. El shell no introduce un componente que consulte datos por su cuenta.

Se normalizaron búsquedas, selects, alturas y foco. Los formularios existentes conservan campos, validaciones y envíos. Los modales comunes emplean `<dialog>` nativo y una trampa explícita de Tab, además de Escape y restauración del foco. Cerrar un formulario de Editor conserva abierto el detalle que lo originó; esto se verificó en la aplicación.

El detalle heredado del proyecto también se incorporó al shell para todos sus consumidores. Se retiró su hero oscuro y su tipografía sobredimensionada. Su navegación por fases sigue existiendo y utiliza desplazamiento local cuando necesita más ancho, sin ensanchar el documento. Los formularios profundos que todavía usan clases antiguas de botón se adaptan desde el patrón compartido.

Desktop mantiene sidebar fijo y usa el ancho disponible. A 768 y 375 px el sidebar se abre con el mismo control de topbar, el mismo drawer y el mismo manejo de teclado. Las tablas operativas conservan sus conversiones a listas; Admin recibe la conversión también en tablet. Los filtros se reorganizan sin introducir cambios de URL ni de su lógica de consulta.

## QA real y correcciones tras mirar la aplicación

Se recorrieron las sesiones de 14 roles disponibles y 48 combinaciones de rol/ruta, a **1440×900, 768×1024 y 375×812**: 144 vistas internas. Se añadieron tres capturas del acceso: **147 vistas finales**. Las nueve rutas de Admin están incluidas. No hubo errores JavaScript, ninguna vista tuvo overflow de documento y todas las topbars internas midieron 60 px. El reporte registra las rutas, títulos, dimensiones y archivos de captura.

La revisión de paneles incluye alta de proyecto, alta de cuenta, Project 360, contexto de tarea de Pipeline, detalle/formulario de Editor, comparación de candidatos de Jefatura, trabajo creativo y detalle de Soporte Digital. Incluye también el detalle heredado de proyectos con sesiones de Comercial, Editor y Digital. No se enviaron mutaciones operativas: los scripts de interacción bloquean cualquier intento de escritura y el reporte conserva esa comprobación.

Durante QA se corrigieron:

- Estilos residuales por atributo ARIA que seguían cambiando la navegación de Corrector y Soportes.
- Fondos de KPI de colores que se imponían sobre las superficies blancas compartidas.
- Salida del foco al tabular desde el último enlace del menú móvil.
- Búsqueda/filtro de estado demasiado estrechos en Digital móvil, al perder una clase usada para composición responsive.
- Tablas administrativas demasiado comprimidas a 768 px.
- Barras de distinta altura al añadir búsqueda global en Admin.
- CTA navy residual dentro del formulario creativo, botones negros de formularios profundos y la tipografía serif inline de aclaraciones.
- Encabezado heredado con degradado y acceso con glassmorphism.
- Capturas iniciales de paneles tomadas antes de cargar sus datos: la versión final del script espera la carga antes de capturar.

Se corrigieron asimismo selectores del script de QA que buscaban “Ver detalle” como nombre accesible aunque el botón tiene una etiqueta contextual “Abrir…”. No se cambió esa etiqueta accesible del producto. Las ejecuciones iniciales se conservan como diagnóstico; solo los reportes finales sustentan los resultados finales.

## Validación y límites

- `npm --prefix frontend run typecheck`: aprobado.
- `npm --prefix frontend run build`: aprobado. Se conserva la advertencia anterior de Vite sobre chunks mayores de 500 kB; no apareció una advertencia nueva de esta migración.
- `npx vitest run frontend/src`: **24 archivos y 257 pruebas aprobadas**. Incluye las 23 suites previas y 17 comprobaciones de los componentes compartidos.
- `npx tsx scripts/design-system-qa.ts`: **147 vistas finales**, sin errores, con menú y retorno de foco en tablet/móvil.
- `npx tsx scripts/design-system-interactions-qa.ts --final`: reporte final en `interactions-final/report.json`, con paneles cargados, trampa de foco, Escape y cero escrituras operativas.
- `node scripts/pagos-ui-states.mjs`: **15 comprobaciones aprobadas** de Pagos, incluyendo monto total/porcentaje y recuperación de errores.
- `npx tsx scripts/proyecto-monto-qa.ts`: **seis comprobaciones aprobadas** de formularios reales; el POST de creación está interceptado y no se guarda ningún proyecto.
- Comparación de diffs de `server/` y `tests/` con el inicio: idénticos. No se modificaron tipos compartidos, reglas, gates, migraciones, estados, integraciones o permisos de backend en esta tarea.

No se añadieron datos demo ni usuarios. Los scripts usan cuentas existentes, crean sesiones temporales y las destruyen al finalizar. No se hicieron cambios financieros, entregas, asignaciones, escrituras en Drive ni operaciones administrativas.

La cobertura real está limitada por las cuentas y datos existentes. Autor y Talento Humano quedan pendientes de QA con una cuenta activa, aunque sus componentes y shells se migraron. Las vistas vacías de algunas bandejas se revisaron como estados vacíos reales; las suites de frontend cubren además presentaciones con datos. No se afirma haber probado cada transición de negocio ni cada combinación posible de datos.

## Entrega e inventario

La base compartida vive en `frontend/src/design-system/` y el shell en `frontend/src/layout/`. Los adaptadores visuales por rol y las páginas afectadas se detallan en `docs/evidencias/design-system/files-changed.json`.

Evidencias:

- `docs/evidencias/design-system/after/report.json`: cobertura final de rutas y resoluciones.
- `docs/evidencias/design-system/interactions-final/report.json`: interacciones finales.
- `docs/evidencias/design-system/validation-summary.json`: resultados consolidados.
- `docs/evidencias/design-system/git-diff-stat.txt`: diff stat final de todo el workspace, incluyendo el trabajo previo de Pagos.
- `docs/evidencias/design-system/git-status.txt`: estado final e inventario de archivos nuevos y modificados.

Las capturas `after/comercial-0-desktop.png` y `after/admin-0-desktop.png` permiten comparar directamente los dos módulos dentro del mismo producto. `before/comercial-0-desktop.png` conserva la referencia previa. El estado Git final queda sin commit ni push para revisión.
