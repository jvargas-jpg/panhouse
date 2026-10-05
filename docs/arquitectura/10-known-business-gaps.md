# Documento 10 — Brechas de Negocio y Validaciones Pendientes
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  
**Regla Rectora:** **NO inventar reglas ni métricas no respaldadas por documentos reales. Marcar formalmente como `PENDIENTE_VALIDACION_DOCUMENTAL`.**

---

## 1. Inventario de Brechas de Negocio Identificadas

| Código de Brecha | Módulo / Documento | Detalle del Vacío o Ambigüedad | Estado / Marca | Mitigación Arquitectónica Implementada |
|---|---|---|---|---|
| **GAP-01** | *Métricas GAP y GAP 2 (Matriz IA)* | **RESUELTO (Fase 5, auditoría diferencial contra `IA Matriz Proyectos - Panhouse - PED-FOR-002.xlsx`, hoja "BDD - IA").** Fórmula real confirmada en la celda viva: `GAP = TODAY() - fecha_fin_proyectada` (columna L) y `GAP2 = IF(GAP > 0, "RETRASADO", "EN TIEMPO")` (columna M). Coincide exactamente (con el signo invertido) con `diasRestantes`/`vencido` ya calculados en `server/helpers/alertas.ts` (`evaluarRiesgoProyecto`) — no requirió ningún cambio de código, solo confirmó que el cálculo ya existente es el correcto. | `CONFIRMADO` | Ninguna — el backend ya implementaba la fórmula correcta antes de tener la fuente; se documenta la equivalencia. |
| **GAP-02** | *Matriz de Dirección Creativa* | El documento específico de Dirección Creativa no fue adjuntado en esta primera ronda. Se conoce el flujo operativo (reunión, brief, 2-3 conceptos, visto bueno de RRPP antes de autor, verificación de cubierta extendida), pero no los KPIs o ponderación de carga del equipo creativo. | `PENDIENTE_VALIDACION_MATRIZ_DIRECCION_CREATIVA` | Se diseña la arquitectura completa de compuertas y entidades (reunión, brief, conceptos, aprobaciones RRPP/autor) sin inventar KPIs de rendimiento creativo que requieran la matriz faltante. |
| **GAP-03** | *Matrices de Soporte Editorial / Calidad* | La empresa tiene 2 matrices internas de Soporte Editorial aún no entregadas en esta ronda. Se conoce el flujo iterativo de rondas de validación de PDF (F1, F2.x, F3, F4.x) y los checklists de la ficha. | `PENDIENTE_MATRICES_SOPORTE_EDITORIAL` | Se diseña el modelo relacional de `ficha_calidad_fases` abierto a N rondas de validación con recuento de comentarios y versión de PDF, extensible a las métricas detalladas que se entreguen en la segunda ronda documental. |
| **GAP-04** | *Pasarela Externa de Pagos (SSO / JWT)* | El módulo actual de pagos es temporal y opera con registro manual de comprobantes y abonos. Existe una integración futura planificada con una plataforma externa vía SSO/JWT. | `PENDIENTE_INTEGRACION_SSO_PAGOS` | El core del proceso editorial y las compuertas de salida se desacoplan de la estructura de tablas de pagos: se guían exclusivamente por el estado de **Solvencia Administrativa** (`solvente = true / false / patrocinado`) certificado por Cobranzas. |
| **GAP-05** | *Clasificación de Causas de Retraso de Proceso* | En la Matriz IA, la columna "Tipo de Retraso" se divide casi exclusivamente en "Autor" (22 casos) y "Proceso" (10 casos). No se detalla qué área interna originó el retraso de proceso. | `PENDIENTE_VALIDACION_DOCUMENTAL` | El sistema soporta la categorización a nivel de work items y pausas para identificar con precisión si el retraso provino de Edición, Diseño, Calidad o RRPP. |

---

## 2. Protocolo para la Segunda Ronda Documental
Cuando se reciban los documentos faltantes (*Seguimiento Corrección - Innovación Editorial.xlsx*, *DIRECCIÓN CREATIVA.xlsx*, *Indicadores Agosto 2026* y las 2 matrices de Soporte Editorial):
1. **NO demoler el código implementado:** Se cotejará campo por campo contra el diccionario canónico ya establecido (`03-data-dictionary.md`).
2. Se incorporarán únicamente los campos y fórmulas validados que aporten valor real al flujo.
3. Se retirarán las marcas `PENDIENTE_VALIDACION_DOCUMENTAL` correspondientes.
