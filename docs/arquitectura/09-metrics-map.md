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
