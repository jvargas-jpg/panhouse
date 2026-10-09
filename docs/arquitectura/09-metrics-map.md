# Documento 09 — Mapa de Métricas e Indicadores de Gestión Editorial
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  
**Regla de Oro:** **Cálculo centralizado en servidor/queries SQL; CERO cálculos pesados o desincronizados dentro de componentes React.**

---

## 1. Catálogo de Indicadores Globales de Jefatura y Dirección

| Indicador | Definición de Negocio | Población / Filtro | Fórmula / Lógica de Consulta (SQL) | Responsable |
|---|---|---|---|---|
| **Proyectos Activos** | Volumen total de libros en producción real o en pausa temporal. | `estado IN ('en_proceso', 'retrasado', 'stand_by', 'pausado')` | `SELECT COUNT(*) FROM proyectos WHERE estado IN ('en_proceso', 'retrasado', 'stand_by', 'pausado')` | Jefatura de Área / Dirección |
| **Proyectos en Proceso** | Libros avanzando con normalidad en su cronograma. | `estado = 'en_proceso'` | `SELECT COUNT(*) FROM proyectos WHERE estado = 'en_proceso'` | Jefatura de Área |
| **Proyectos Retrasados** | Libros que han excedido su fecha fin proyectada o el SLA de la fase activa sin estar formalmente pausados. | `estado = 'retrasado'` (o derivado: `CURRENT_DATE > fecha_fin_proyectada`) | `SELECT COUNT(*) FROM proyectos WHERE estado = 'retrasado'` | Jefatura de Área |
| **Proyectos Stand-by** | Libros en espera corta o con exoneración contractual acordada. | `estado = 'stand_by'` | `SELECT COUNT(*) FROM proyectos WHERE estado = 'stand_by'` | Jefatura de Área |
| **Proyectos Pausados** | Libros con suspensión formal mayor a un mes, con certificación de pago al día. | `estado = 'pausado'` | `SELECT COUNT(*) FROM proyectos WHERE estado = 'pausado'` | Jefatura / Cobranzas |
| **Proyectos Culminados** | Libros con paquete final entregado y proceso cerrado. | `estado = 'culminado'` | `SELECT COUNT(*) FROM proyectos WHERE estado = 'culminado'` | Jefatura / Dirección |
| **Proyectos Retirados** | Proyectos dados de baja por rescisión contractual. | `estado = 'retirado'` | `SELECT COUNT(*) FROM proyectos WHERE estado = 'retirado'` | Jefatura / Dirección |
| **Ingresados vs. Culminados por Mes** | Serie temporal mensual para comparar el ritmo de ventas frente al ritmo de entrega de producción. | Histórico completo agrupado por mes de inicio vs mes de culminación | Agrupación mensual por `date_trunc('month', fecha_programada_inicio)` vs `date_trunc('month', fecha_aprobacion_final)` | Dirección General |

---

## 2. Indicadores por Especialista Editorial

| Métrica | Definición | Fórmula / Consulta |
|---|---|---|
| **Proyectos Activos por Especialista** | Cantidad de libros asignados actualmente a cargo del especialista. | `COUNT(*) FROM proyectos WHERE especialista_id = :id AND estado IN ('en_proceso', 'retrasado', 'stand_by', 'pausado')` |
| **Carga Ponderada del Especialista** | Carga de trabajo ajustada por la complejidad técnica y duración del servicio contratado. **`PENDIENTE_DEFINICION_PESOS_CARGA` (magnitud):** el mecanismo ya es configurable (`servicios.pesoComplejidad`, leído vía `JOIN`, nunca hardcodeado en React) y el **orden** EF > CR > SE está confirmado por el negocio (`EEC`/`EET` existen en el catálogo pero están retiradas, `activo = false`, desde antes de esta rearquitectura; `CR` las reemplazó). La **magnitud** exacta de cada peso (hoy `EF=4, CR=3, SE=1` en `server/db/seed.ts`) sigue sin confirmación formal del negocio — ver el comentario de origen en `server/db/schema/servicios.ts`. | $\sum (\text{pesoComplejidad})$ con los valores vigentes hoy en `servicios` (no hardcodear; leer de la tabla).<br>`SELECT SUM(s.peso_complejidad) FROM proyectos p JOIN servicios s ON p.servicio_id = s.id WHERE p.especialista_id = :id AND p.estado IN ('en_proceso', 'retrasado', 'stand_by', 'pausado')` |
| **Días de Ejecución** | Tiempo transcurrido desde el inicio real o programado del proyecto hasta la fecha actual (o hasta la fecha de cierre si culminó), descontando pausas formales. | `(COALESCE(fecha_aprobacion_final, CURRENT_DATE) - fecha_inicio) - SUM(dias_pausa_externa)` |
| **Días Sobrantes (SLA)** | Días de margen disponibles antes de incurrir en retraso respecto a la fecha fin proyectada. | `fecha_fin_proyectada - CURRENT_DATE` (si es negativo, indica días de mora). |
| **Cumplimiento de Primer Contacto** | Porcentaje de proyectos donde el especialista contactó al autor en menos de 24 horas tras la asignación. | $\frac{\text{Proyectos contactados en } \le 24\text{h}}{\text{Total asignados}} \times 100$ |

---

## 3. Indicadores de Edición (Jefe de Edición y Editores)

| Métrica | Definición | Fórmula / Consulta |
|---|---|---|
| **Carga Ponderada de Editores** | Suma de complejidad de proyectos asignados al editor en `proyectos.editor_id`. | `SELECT SUM(s.peso_complejidad) FROM proyectos p JOIN servicios s ON p.servicio_id = s.id WHERE p.editor_id = :editorId AND p.estado IN ('en_proceso', 'retrasado')` |
| **Cumplimiento de SLA por Capítulo** | Porcentaje de entregas de capítulos realizadas dentro del plazo de 3 días laborables. | `SELECT (COUNT(CASE WHEN fecha_entrega_editor <= fecha_inicio_editor + INTERVAL '3 days' THEN 1 END)::float / COUNT(*)) * 100 FROM capitulos ...` |
| **Promedio de Páginas Editadas** | Promedio de páginas procesadas por entrega. | `AVG(paginas) FROM capitulos WHERE editor_id = :editorId` |

---

## 4. Indicadores de Corrección Ortotipográfica

| Métrica | Definición | Fuente / Consulta |
|---|---|---|
| **Cumplimiento Plazo de Corrección** | Entregas completadas en 5 días continuos o menos. | `fecha_entrega <= fecha_inicio + INTERVAL '5 days'` en `seguimiento_fases`. |
| **Volumen de Páginas Corregidas** | Páginas totales revisadas por analista/corrector. | `SUM(paginas) FROM seguimiento_fases WHERE analista_id = :id` |
| **Calidad de Corrección (F1 Feedback)** | Incidencias y comentarios que sobrevivieron a la corrección y fueron detectados en Fase 1 de Calidad. | Registrado en `seguimiento_fases.cantidad_comentarios` y observaciones de calidad. |

---

## 5. Indicadores de Calidad y Validación

| Métrica | Definición | Fuente / Consulta |
|---|---|---|
| **Promedio de Comentarios en Fase 1** | Promedio de errores de diseño y texto en la V1 maquetada. | `AVG(cantidad_comentarios) FROM ficha_calidad_fases WHERE numero_fase = 1` |
| **Índice de Iteraciones de Calidad** | Promedio de rondas necesarias para limpiar una tripa diagramada (Fase 1 + Fases 2.x). | Cantidad de filas en `ficha_calidad_fases` por proyecto hasta obtener `aprobado = true`. |

## 6. Indicadores RRPP — Lanzamiento, promoción y asesoría

Implementación: `GET /api/rrpp/indicadores?from=YYYY-MM-DD&to=YYYY-MM-DD`.
Owner de todas las métricas siguientes: **RRPP**; lectura autorizada para **RRPP y Dirección**.
Agregación PostgreSQL, tres consultas en una transacción `REPEATABLE READ READ ONLY`.
No se crean tablas de métricas, notificaciones ni trabajo en una lectura.

### Períodos y poblaciones

- `from` y `to` son inclusivos, en **America/Caracas**. Timestamps usan
  `[from 00:00 local, día posterior a to 00:00 local)`; columnas date usan BETWEEN.
  Default: 1 de enero hasta hoy. Rango máximo 732 días; ambos extremos obligatorios
  cuando se especifica uno. Mes actual / últimos 3 y 6 meses son meses calendario
  hasta hoy, indicados por fechas visibles; rango personalizado permite años completos.
- **Cohorte de planificación**: una fila de `work_items` por proyecto, tipo
  `lanzamiento`, business key `planificacion`, creada en el período. La unicidad
  canónica impide duplicados. Incluye todos los estados del trabajo; cancelados
  se informan aparte. Un intake de RRPP no es una planificación.
- **Cohorte de piezas**: `rrpp_publicaciones.created_at` en el período.
- Fases, fechas disponibles, ferias, satisfacción e intereses son **estado actual
  de la cohorte de planificación**, no un snapshot retrospectivo del período.
  Las distribuciones de piezas usan su cohorte de creación y estado actual.
- Para cada comparación temporal se usan **N días inmediatamente anteriores**,
  donde N es el número de días inclusivos del intervalo elegido. Fórmula
  `100 * (actual - anterior) / anterior`; si anterior es cero, valor null y
  «Sin base de comparación». No se compara satisfacción ni intereses porque
  no existe un historial de valores que permita reconstruir esas observaciones.

### Catálogo: NAME / SOURCE / DEFINITION / FORMULA / POPULATION / PERIOD / OWNER

| NAME | SOURCE | DEFINITION / FORMULA | POPULATION | PERIOD | OWNER |
| --- | --- | --- | --- | --- | --- |
| Proyectos con planificación | work_items | COUNT de proyectos con planificación activada, sin inferir realización | Cohorte de planificación | Fecha de creación del trabajo | RRPP |
| Eventos realizados | rrpp_eventos.estado, fecha | COUNT con estado normalizado Completada y fecha <= hoy | Eventos RRPP, sin reuniones de intake | Fecha del evento dentro del rango | RRPP |
| Piezas publicadas | rrpp_publicaciones + audit_logs | COUNT de piezas cuya **primera** PUBLICACION_RRPP_REALIZADA (`entity_type=publicacion_rrpp`, FK por entity_id) fue registrada en el período; MIN por pieza evita contar retries o republicaciones | Piezas con confirmación auditada, independientemente de su fecha de creación | Timestamp de la primera confirmación, no fecha efectiva en redes | RRPP |
| Satisfacción: Excelente | fichas_trazabilidad.asesoria_nivel_satisfaccion | 100 * Excelente / (Excelente + Bueno + Regular); null sin valoraciones | Cohorte de planificación; sin registrar fuera del denominador | Observación actual de cohorte activada en rango | RRPP |
| Intereses adicionales | fichas_trazabilidad.asesoria_venta_cruzada | COUNT DISTINCT (proyecto, interés normalizado no vacío) | Cohorte de planificación, interés explícito; no notas libres ni aceptación especializada | Observación actual de cohorte activada en rango | RRPP |
| Lanzamientos realizados por mes | rrpp_eventos.tipo, estado, fecha | COUNT de eventos Completada con fecha no futura y tipo Lanzamiento / Lanzamiento digital / Lanzamiento en Amazon / Lanzamiento en feria | Eventos concretos de lanzamiento; varias instancias son varios eventos | Fecha del evento, agrupación mensual local | RRPP |
| Planificaciones activadas por mes | work_items | COUNT de activaciones canónicas | Cohorte de planificación | created_at local, por mes | RRPP |
| Fases actuales | Ficha.asesoria_fase | COUNT por fase; denominator = todos los proyectos de la cohorte, null/errores visibles como Sin clasificar | Cohorte completa, incluye cancelados | Activación en rango, estado actual | RRPP |
| Planes cancelados | work_items.estado | COUNT con estado cancelado | Cohorte de planificación | Activación en rango, estado actual | RRPP |
| Disponibilidad de fecha | Ficha.asesoria_fecha_pautada_autor, lanzamiento_promocion_fecha_tentativa | Partición excluyente: Fecha pautada / Solo tentativa / Sin fecha | Cohorte de planificación | Activación en rango, estado actual | RRPP |
| Ferias proyectadas | Ficha.asesoria_feria_proyectada | COUNT por valor, Sin feria registrada para null | Cohorte de planificación | Activación en rango, estado actual | RRPP |
| Eventos registrados / tipos / estados | rrpp_eventos | COUNT total y GROUP BY tipo/estado normalizados; conserva tipos adicionales | Todos los eventos fechados dentro del rango, realizados o programados | fecha | RRPP |
| Próximos eventos del período | rrpp_eventos + proyecto + autores | Fecha > hoy, estado != Completada, orden fecha/id, máximo 6 | Eventos del rango elegido | Fecha futura dentro de rango | RRPP |
| Piezas registradas / tipos / estados | rrpp_publicaciones | COUNT y GROUP BY tipo/estado actual; incluye unknown explícito | Cohorte de piezas | created_at local | RRPP |
| Publicadas sin fecha verificable | rrpp_publicaciones + audit_logs | COUNT estado Publicado sin confirmación auditada; excluidas del KPI temporal | **Base completa**, indicador de calidad, no filtrable por una fecha inexistente | Sin fecha, explícitamente fuera del filtro | RRPP |
| Reuniones realizadas / tipos | Ficha y ficha_lanzamiento_reuniones | COUNT con realizada IS TRUE y fecha <= hoy; primera/segunda canónicas UNION ALL adicionales | Proyectos con planificación canónica, no reuniones de Especialista ni intake | Fecha de reunión dentro del rango | RRPP |
| Promedio de reuniones por planificación | Ficha + reuniones + work_items | Reuniones realizadas del período de proyectos de la cohorte / proyectos de la cohorte; null si denominador cero | Cohorte de planificación | Activación y fecha de reunión en rango | RRPP |
| Segunda reunión pendiente | Ficha + work_items | COUNT segunda_realizada IS NOT TRUE, fase != Culminado, trabajo != cancelado | Cohorte de planificación | Activación en rango, estado actual | RRPP |
| Reuniones sin confirmación | Ficha + reuniones | COUNT con fecha y realizada IS NULL; no asumir que sucedió | Planificaciones canónicas, primera/segunda/adicionales | Fecha de reunión en rango | RRPP |
| Distribución de satisfacción | Ficha | COUNT por Excelente/Bueno/Regular/Sin registrar y valores desconocidos preservados | Cohorte completa | Activación en rango, estado actual | RRPP |
| Oportunidades por tipo / proyectos | Ficha.asesoria_venta_cruzada | COUNT por tipo de pares únicos, COUNT DISTINCT proyecto con interés | Cohorte con al menos un interés explícito | Activación en rango, estado actual | RRPP |
| Próximos lanzamientos pautados | Ficha + work_items + proyectos + autores + project_assignments | Fecha pautada por autor > hoy; fase != Culminado; trabajo != cancelado; proyecto no culminado/retirado; orden fecha/id, máximo 6 | Todas las planificaciones canónicas con fecha pautada | **Futuro independiente del rango histórico**; no utiliza solo fecha tentativa | RRPP |
| Últimas piezas registradas | rrpp_publicaciones + proyectos + autores + usuarios | Registros de la cohorte, orden created_at DESC / id, máximo 6; autor/coautores canónicos, tipo, responsable y estado | Cohorte de piezas | Fecha de **registro**, no fecha de lanzamiento ni de publicación | RRPP |
| Histórico mensual | Las mismas fuentes de los KPIs | Series de cada intervalo con sus propias fronteras; meses sin registros = 0; un mes compartido se recorta separadamente | Hechos correspondientes a cada definición anterior | Rango seleccionado y N días anteriores | RRPP |

Porcentajes de distribución agregados en SQL: `cantidad / SUM(cantidad)`, redondeo a décimas
con reparto del residuo por mayor fracción (desempate por nombre). Suman 100%
para cualquier distribución no vacía. Los porcentajes de satisfacción se redondean
normalmente a una décima, con su denominador de valoraciones documentado.
El desglose de tipos de reuniones usa los tres conteos agregados confirmados,
divididos por reuniones realizadas y redondeados a una décima; por redondeo
su suma puede diferir de 100% en una décima.

### Normalización y límites de evidencia

Se normalizan espacios/mayúsculas de valores canónicos; `En asesoriamiento`
equivale a `En asesoramiento`. Blank, null y errores `#REF!/#N/A/#VALUE!` se
presentan como Sin clasificar; en satisfacción como Sin registrar. Los valores
desconocidos se preservan. Venta cruzada usa equivalencias de las diez opciones
canónicas de `rrppLanzamientoCatalogos.ts`, sin descartar tipos adicionales.
Tipos de eventos se agrupan por texto normalizado, sin un catálogo incompleto.
Primera/segunda reunión se leen exclusivamente de `lanzamiento_promocion_*`;
los aliases `asesoria_fecha_*` no se suman otra vez. Fechas antiguas sin flag
de realización permanecen desconocidas.

**Fuentes disponibles en esta implementación:** schema, Ficha canónica,
workflows y auditoría de `docs/arquitectura/26-rrpp-lanzamientos-eventos.md`.
Los originales XLSX/DOCX de `fuentes-negocio/` no están en esta copia ni en los
adjuntos actuales; no se afirma haberlos reinspeccionado. La documentación
anterior registra Bueno/Excelente/Regular y las opciones de venta cruzada de la
Matriz. No se importó el histórico legacy ni se inventaron registros faltantes.

Se omite **Canales de publicación** por ausencia de campo canónico; se sustituye
por **Estado de publicaciones**. Se omiten escala 1–5/NPS, funnel de oportunidades,
ROI/ventas/alcance/engagement y comparación histórica de estados. No hay fecha
efectiva de publicación: la primera confirmación auditada es una fecha de registro
explícita. Culminar una asesoría no prueba por sí solo que ocurrió un lanzamiento.
Los próximos lanzamientos no infieren feria/lugar de un evento distinto; se usa
la feria confirmada/proyectada de la Ficha. El tipo mostrado es la modalidad
registrada (por ejemplo ONLINE), sin sustituirlo por una categoría de evento.

### Validación — 9 de octubre de 2026

`tests/rrppIndicadores.test.ts`: 50 casos para los cinco KPIs, categorías,
fronteras inclusivas, Caracas histórico, comparaciones, tablas y RBAC/solo lectura.
Suite completa: 971 tests aprobados en 52 archivos, ejecutada con las migraciones
reales en PostgreSQL 16 temporal y aislado. Typecheck y build de backend y frontend
aprobados. Vite conserva el aviso de tamaño del bundle principal; los gráficos
RRPP se cargan de forma diferida y comparten Recharts con Comercial.
QA visual en navegador a 1440×900 y 375×812: siete pestañas, rango vacío y cambio
real de período, teclado y tablas; documento móvil de 375 px sin overflow global.
No se modificaron los datos de desarrollo para esta implementación.
