# Jefatura · Indicadores

Implementación del 11 de octubre de 2026. Acceso: `/?vista=indicadores`, rol `jefe_area`.

## Auditoría previa y fuentes

Se revisaron los modelos, las rutas de proyectos y Jefatura, el cálculo central de carga, la clasificación Express, los plazos por servicio, las pausas y la proyección integrada de Seguimiento. La presentación local `INDICADORES AGOSTO 2026.pptx` se inspeccionó en modo de solo lectura: 32 diapositivas, SHA-256 `4ed6de57e2b578fd1b9af449dcfee39fb6afa2f9f0965c1835b63692f4a020be`. El archivo mantiene ese hash después del trabajo. La imagen del usuario guía la jerarquía, los gráficos, la tabla con detalle de especialista y los colores; los datos proceden exclusivamente de la aplicación.

La presentación organiza producción mensual, ingresos frente a culminados, rendimiento del equipo, servicios, plazos, Edición y Corrección. No se importaron sus cifras ni sus identidades. Sus totales no siempre coinciden entre secciones; su GAP usa días ejecutados menos plazo, mientras la aplicación usa plazo menos tiempo efectivo. Se conserva la fórmula nativa y la interfaz lo llama **Margen**: negativo significa plazo excedido.

Registro de la auditoría sin identidades del documento: [indicadores-fuente-2026-08.json](../auditoria/indicadores-fuente-2026-08.json).

## Métricas y semántica

Hay tres secciones: **Resumen**, **Equipo y capacidad**, **Tiempos y SLA**.

| Métrica | Fuente y criterio |
| --- | --- |
| Proyectos activos | Ámbito de Producción de Jefatura; estados centrales `en_proceso`, `retrasado`, `stand_by`, `pausado`. |
| Por asignar | Activos recibidos por Jefatura sin especialista actual. |
| En riesgo | Evaluación central de proyecto y procesos; incorpora plazos, bloqueos, vencimientos y pausas. |
| Express confirmado | Clasificación nativa de Jefatura. Los posibles Express se muestran aparte. |
| Carga del equipo | Suma de `servicios.pesoComplejidad` de los activos asignados mediante `calcularCarga`. La carga sin asignar se informa aparte. |
| Cierres registrados | Primera transición auditada a `culminado`, fechada dentro del período. El responsable se conserva en el evento. |
| Ingresos a Producción | Primer evento `JEFATURA_NOTIFICADA`; no se usa la creación comercial del proyecto. |
| Asignaciones | Filas formales de `project_assignments`, tipo especialista, a nivel de proyecto, fechadas en el período. Incluye nuevas asignaciones y reasignaciones. |
| Distribución del trabajo | Activos agrupados por servicio/subtipo, estado y prioridad. Crudo Capítulo y Crudo Tripa mantienen el mismo peso de su catálogo. |
| Desempeño por especialista | Activos, carga, Express, riesgo, vencidos, cierres registrados y asignaciones; tabla y detalle de proyectos con paginación de cinco filas. |
| SLA | Entregas nativas de Corrección y Calidad con timestamp de entrega y deadline reales. Sin ambos no se calcula cumplimiento. |
| Tiempo efectivo | Promedio de entregas con inicio y fin precisos, utilizando la proyección central que descuenta pausas. Se muestra el tamaño de muestra. |

La asignación activa formal prevalece sobre la FK heredada del proyecto. Un usuario inactivo conserva su trabajo y sus resultados visibles, pero no entra en la recomendación. “Menor carga en esta vista” compara únicamente la selección actual y utiliza el orden central de candidatos; no supone una capacidad máxima contractual.

### Períodos y filtros

Los filtros globales son fechas, servicio, especialista, prioridad y estado actual; se conservan en la URL. Los presets cubren el mes actual, mes anterior, últimos tres meses y año actual. El backend valida fechas de calendario, ambos extremos, orden y un máximo de 366 días.

**Las fechas filtran movimientos y entregas. La cartera, carga y riesgo son un corte actual.** No se reconstruye una cartera histórica inexistente. La comparación utiliza el período anterior de igual duración, con límites de día en `America/Caracas`. Los gráficos muestran seis o doce meses calendario hasta el mes de la fecha final; excluyen eventos futuros, incluso en el último mes.

Servicio, prioridad y estado clasifican los proyectos según su situación actual. El especialista restringe la cartera y sus entregas según su asignación actual, los cierres según el responsable guardado al culminar y las asignaciones según su usuario formal. Los ingresos pertenecen a la cartera seleccionada actualmente. Estas dimensiones no implican un historial de cambios de servicio o estado.

La búsqueda dentro de la tabla es una selección visual de especialistas, distinta de los filtros globales. El CSV exporta toda la tabla correspondiente a los filtros globales; la impresión reproduce la vista elegida.

### Datos incompletos

Los culminados antiguos no tienen una fecha nativa fiable. `updatedAt` no se interpreta como cierre. Si no hay cierres fechados y existen culminados sin fecha en la selección, se devuelve `null` y se muestra “Sin datos suficientes” o `—`. Cuando existe cobertura parcial, se muestran únicamente los cierres registrados y se informa cuántos culminados carecen de fecha.

Un ingreso antiguo señalado por una bandera pero sin evento no se atribuye a un mes. Las entregas nativas con fecha pero sin hora cuentan como volumen, pero no como muestra del SLA ni del promedio horario. Un deadline ausente no se fabrica; una revisión de Calidad que pide ajustes sigue siendo una revisión realizada, separada de su aprobación. Un Crudo sin clasificación suficiente no muestra un margen interpretado con un plazo supuesto.

## Backend, acceso y rendimiento

- `GET /api/jefatura/indicadores`: respuesta agregada tipada.
- `GET /api/jefatura/indicadores/export.csv`: CSV con los mismos filtros y reglas.
- Ambos requieren sesión y rol `jefe_area`; otros roles, incluida Dirección, reciben 403. Sin sesión reciben 401. Respuestas privadas sin caché compartida.
- `obtenerIndicadoresJefatura` reutiliza el snapshot de Jefatura, la carga y orden central de candidatos, el período de RRPP y la proyección nativa de Seguimiento.
- `obtenerIntervencionesIndicadores` lee Corrección/Calidad y pausas por lotes, sin paginación que reduzca los totales. Convierte explícitamente las fechas SQL sin hora a texto de calendario para evitar su interpretación como timestamps.
- Medición con 42 proyectos: **13 consultas** para toda la respuesta. El test compara una y once filas y exige que la cantidad permanezca constante, con límite de 15.
- La pantalla carga de forma diferida y no solicita simultáneamente el dashboard de Inicio.

### Registro de futuros cierres

La ruta operativa existente `PATCH /api/proyectos/:id` pasa el actor autenticado a `actualizarProyecto`. El helper bloquea el proyecto, actualiza y registra `PROYECTO_ESTADO_CAMBIADO` en una transacción, con estado previo/nuevo y especialista canónico en ese momento. La repetición del mismo estado no duplica el evento y un fallo de auditoría revierte la actualización.

No se agregó una tabla ni una migración: se utiliza la auditoría existente. Tampoco se cambian los permisos operativos del Especialista. Cada proyecto se cuenta una vez por su primera culminación auditada; reabrir y volver a culminar no duplica el indicador. Una reasignación posterior conserva la atribución original del cierre. No se rellenaron fechas históricas supuestas.

## Exportación y ampliación

El CSV contiene especialista, habilitación, activos, carga, Express, riesgo, vencidos, cierres, asignaciones y fechas del período. Usa UTF-8 con BOM, comillas correctas y neutralización de valores de texto que podrían ejecutarse como fórmulas. La descarga procede de la API real.

“Imprimir reporte” abre la impresión del navegador, con posibilidad de guardar como PDF. La hoja A4 horizontal incluye período, filtros, tarjetas, gráficos, tabla y cobertura; oculta navegación y controles. Las reglas de impresión liberan el alto y overflow de los contenedores de la aplicación, para impedir recortes. El detalle de especialista mantiene la página visible elegida; el CSV incluye todos los especialistas de la selección.

El contrato compartido, la agregación por fuentes y el desglose por etapas permiten ampliar el reporte con métricas de Edición y series históricas adicionales cuando existan eventos fiables. Actualmente no se inventan tasas de productividad de editores, calidad histórica, capacidad máxima ni causas de retraso no estructuradas.

## Archivos

Nuevos:

- `frontend/src/jefatura/IndicadoresPage.tsx`: consultas, filtros, secciones y exportación.
- `frontend/src/jefatura/IndicadoresElements.tsx`: KPIs, tarjetas, estados y SLA.
- `frontend/src/jefatura/IndicadoresCharts.tsx`: tendencias, distribución y carga.
- `frontend/src/jefatura/IndicadoresEquipo.tsx`: tabla y detalle de especialista.
- `frontend/src/jefatura/indicadoresApi.ts`, `indicadores.css`: API tipada, períodos y diseño responsive/impresión.
- `shared/indicadoresJefatura.ts`: contrato de datos y filtros.
- `server/helpers/indicadoresJefatura.ts`, `server/routes/indicadoresJefatura.routes.ts`: agregación, CSV y endpoints.
- `tests/indicadoresJefatura.test.ts`: 17 pruebas de reglas, fuentes, acceso, exportación y rendimiento.
- `scripts/indicadores-isolated-qa.ts`, `indicadores-browser-qa.mjs`: escenarios aislados y verificaciones del navegador.
- Este documento, `docs/auditoria/indicadores-fuente-2026-08.json` y `docs/evidencias/indicadores-jefatura/`.

Modificados:

- `frontend/src/jefatura/PanelJefaturaPage.tsx`, `frontend/src/layout/AppLayout.tsx`: integración en el marco de Jefatura y carga diferida.
- `server/app.ts`: registro de rutas.
- `server/helpers/jefatura.ts`: opción de lectura histórica que incluye retirados; carga/riesgo siguen limitados a activos.
- `server/helpers/seguimientoIntervenciones.ts`: reutilización por lotes de la proyección nativa.
- `server/helpers/proyectos.ts`, `server/helpers/auditLog.ts`, `server/routes/proyectos.routes.ts`: auditoría transaccional de cambios de estado.

## Validación

- Backend: `npm run typecheck` y `npm run build`, exit 0.
- Frontend: `npm run typecheck` y `npm run build`, exit 0. Vite conserva el aviso de un chunk principal superior a 500 kB; Indicadores tiene su propio chunk diferido de aproximadamente 43 kB.
- Regresión relevante: **220 pruebas, siete archivos, todas aprobadas**. La primera ejecución incluye Proyectos/rutas, Jefatura, Seguimiento operativo/rutas e Indicadores: 197 pruebas. Decisiones añade 23. No se atribuye este resultado a una ejecución de toda la suite.
- Las 17 pruebas nuevas cubren pesos reales y subtipos, asignación canónica, estados activos, Express, usuarios inactivos, períodos y huso horario, fuentes históricas, ausencia de timestamps/deadlines, pausas, atribución del cierre, idempotencia y rollback, RBAC, validación y CSV seguro, y consultas constantes.
- Navegador: **37 comprobaciones aprobadas**, sin errores de ejecución. Escritorio 1536×1024, laptop 1366×768, tablet 768×1024 y móvil 375×812. Se revisaron capturas y se corrigieron el ancho de la tabla móvil, la superposición de botones y los recortes de impresión. Tabla móvil con scroll interno; ninguna sección desborda horizontalmente el documento.
- La evidencia del navegador incluye filtros, persistencia al recargar, selección y paginación, vistas vacías, carga, error/reintento, CSV, impresión y ausencia de errores de ejecución. Los escenarios de volumen son sintéticos y están únicamente en la base desechable `panhouse_indicadores_qa`.
- Desarrollo real: lectura autenticada en `http://localhost:5173/?vista=indicadores`, API 200, sin errores de navegador ni escrituras. El ámbito actual incluye siete activos, mientras la base conserva sus 30 proyectos; el indicador aplica el ámbito real de Producción. Correcciones y Decisiones permanecen en cero en esa base.
- Limpieza: servidores QA 3006/5177 detenidos y bases temporales `panhouse_indicadores_qa`/`panhouse_codex_decisiones_test` eliminadas. Se conservaron la base principal, la base preexistente de portafolio QA y los servicios habituales 3000/5173. Las sesiones de prueba permanecen fuera del repositorio.

Evidencia: [verificación del navegador](../evidencias/indicadores-jefatura/verificacion-browser.json), [desarrollo real](../evidencias/indicadores-jefatura/verificacion-desarrollo.json), [consultas](../evidencias/indicadores-jefatura/consultas.json), [escritorio](../evidencias/indicadores-jefatura/desktop-despues.png), [móvil](../evidencias/indicadores-jefatura/mobile-despues.png), [impresión](../evidencias/indicadores-jefatura/impresion.png).

## Límites reales

No existe una fecha comprobable para todos los cierres antiguos, ni un snapshot histórico de cartera, prioridad, servicio y responsabilidad. Las series son de hechos registrados y los filtros de categoría usan el estado actual. El registro añadido mejora los futuros cierres sin alterar el pasado. Edición aún no dispone de la cobertura necesaria para publicar aquí un SLA equivalente al de Corrección/Calidad. La recomendación de menor carga es relativa a la selección, no una promesa de disponibilidad individual.
