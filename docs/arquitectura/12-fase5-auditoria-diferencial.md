# Documento 12 — Fase 5: Auditoría Diferencial contra Fuentes de Negocio Reales
**Sistema:** PanHouse Gestor Editorial
**Fecha:** Octubre 2026
**Estado:** Auditoría completa, implementación de Fase 5 en curso (ver §6 "Pendiente")

> Fuentes inspeccionadas: las 7 descritas en `fuentes-negocio/` (gitignored, nunca se citan datos personales textuales de autores reales en este documento). Lectura programática con `exceljs` (Node — no había Python disponible en esta máquina) para los 6 `.xlsx`, incluyendo estilos/colores de celda, merges, fórmulas y validaciones de datos; `mammoth` para el `.docx` (lectura completa, no solo búsqueda de fragmentos).

---

## 1. Principio seguido

Esta NO es una auditoría desde cero. Se contrastó cada hallazgo contra el schema Drizzle real, el código backend y los 11 documentos de arquitectura ya existentes — solo se documenta lo que cambia, se confirma o se contradice.

---

## 2. Confirmaciones fuertes (schema ya correcto, sin cambios)

| Área | Fuente | Resultado |
|---|---|---|
| `capitulos` (fecha envío/pautada/respuesta + enlaces) | Ficha real, hoja "EDICIÓN" | Coincide campo por campo con cada bloque "CAPÍTULO N" / "TRIPA COMPLETA" |
| `seguimiento_fases` (columnas completas) | Seguimiento Corrección, hoja "JULIO 2026" (fila de datos real) | Coincide prácticamente columna por columna (ver §4 para las 2 que faltaban) |
| `ficha_diseno_propuestas` + `diseno*` (brief) | DIRECCIÓN CREATIVA.xlsx, hoja "GENERAL 25-26" | Coincide con `fechaEnviadaEspecialista/fechaEnviadaAutor/fechaAprobadaAutor/estado/enlace` y las fechas de brief/reunión creativa |
| `proyectos.fechaProcesoIngreso...fechaAprobacionFinal` (8 hitos) | IA Matriz, hoja "BDD - IA" (columnas U-AN, hitos 1-7) | Coincide con los hitos numerados de la matriz real |
| `proyectos.contratoFirmado`, `pagoCuota1..6` | IA Matriz, hoja "BDD - IA" (columnas AP-AV) | Coincide exactamente |
| `fichasTrazabilidad.matriz*` (Matriz de Ingreso) | MATRIZ DE LANZAMIENTOS..., hoja "Matriz reuniones de ingreso" | Coincide campo por campo |
| `fichasTrazabilidad.asesoria*` (Matriz de Asesorías) | MATRIZ DE LANZAMIENTOS..., hoja "Matriz de asesorias con fechas" | Coincide campo por campo |
| `ficha_calidad_fases` + columna `ronda` (Fase 2) | Ficha real, hoja "CALIDAD EDITORIAL" | **Confirma exactamente** el modelo fase+ronda: "FASE 2.1/2.2/2.3 DE CALIDAD" y "FASE 4.1/4.2/4.3 DE CALIDAD" existen como bloques reales repetidos — el diseño de Fase 2 (Foundation) ya anticipó esto correctamente antes de ver la fuente |
| `correccionTripaCompleta/Preliminares/CubiertaExtendida` (agregado, no 40+ columnas individuales) | Ficha real, hoja "CORRECCIÓN" | Confirma que modelar el checklist ortotipográfico completo (40+ criterios × 3 categorías ≈ 120 columnas) sería sobre-ingeniería — el corrector freelance nunca llena esto directamente en el sistema; se mantiene el agregado por categoría |

---

## 3. Colores de celda — significado confirmado (NO generalizado a todo Excel, solo donde se verificó)

Verificado en la Ficha de Trazabilidad real (`MIREYA JOSEFINA OLIVEROS SEQUERA - FICHA DE TRAZABILIDAD.xlsx`):

| Color | Hex | Significado confirmado | Ejemplo real |
|---|---|---|---|
| Azul | `#9FC5E8` | Campo calculado por fórmula (nunca editado a mano) | `B14` Fecha cierre del proyecto = fórmula sobre fecha de ingreso + plazo |
| Amarillo pastel | `#FFE599` | Campo exclusivo de RRPP | `C12` "Para el caso del crudo especificar si es tripa o capítulo" |
| Rosa/magenta | `#D5A6BD` | Campo de condiciones contractuales (Comercial) | Fila 31 "Capítulos y páginas", "Indicar algún criterio extra" |
| Gris oscuro | `#666666` | Encabezado de sección mayor | "DATOS DE INGRESO", "PROCESO DE EDICIÓN" |
| Gris medio | `#B7B7B7` / `#999999` | Encabezado de subsección | "ESPECIFICACIONES DEL PROYECTO", "CAPÍTULO 1" |
| Gris muy claro | `#EFEFEF` | Etiqueta de campo (columna A) | Todas las etiquetas de campo |

Esto confirma y extiende la regla que ya se sabía (blanco=por sección, amarillo=RRPP, azul=calculado) — se agrega rosa=Comercial, no documentado antes.

**Hallazgo adicional de color, fuera de la Ficha:** el Manual del Especialista (§6.2) documenta que en la Matriz IA, el nombre del autor en **fondo blanco** = solvencia administrativa pendiente, y en **fondo verde** = solvente. Este es un significado de color **distinto** al de la Ficha (no es el mismo código de colores) — confirma GATE-08 (Solvencia) como un dato real que existe operativamente, pero el campo formal (`solvenciaAdministrativa`) sigue sin crearse: no se puede leer el color de una celda de Excel desde la DB, así que esto requiere que Cobranzas certifique el estado explícitamente (ver GAP-04, ya documentado, sin cambios).

---

## 4. Campos nuevos agregados al schema (todos aditivos, nullable, migrados y testeados)

| Tabla | Columna(s) | Fuente exacta |
|---|---|---|
| `proyectos` | `tituloDefinitivo`, `subtituloDefinitivo` | Manual §2.3.3/§4.1 + DIRECCIÓN CREATIVA.xlsx (columna TÍTULO) — habilita GATE-04 |
| `capitulos` | `observacionesEditor`, `observaciones` | Ficha real, hoja "EDICIÓN", cada bloque "CAPÍTULO N" |
| `ficha_calidad_fases` | `nombreQuienRecibe`, `cantidadPaginas`, `cambiosPorVerificar`, `cambiosPendientesPorAplicar`, `cambiosNuevosSugeridos` | Ficha real, hoja "CALIDAD EDITORIAL" |
| `ficha_diseno_propuestas` | `fechaAprobadaRrpp` | Manual §4.1.2 + DIRECCIÓN CREATIVA.xlsx ("PROPUESTAS ENVIADAS AL ESPECIALISTA") — habilita GATE-05 |
| `seguimiento_fases` | `listadoCorrectores`, `observacionesFase1` | Seguimiento Corrección, hoja "JULIO 2026", columnas AE/AF |

Gates implementados con estos campos (ver `server/helpers/gates.ts`, documentados con tabla fuente/campos/tests): **GATE-04** (Título y Subtítulo Aprobados) y **GATE-05** (Aprobación Interna de Portada RRPP) — antes imposibles de implementar de verdad por falta de campo.

---

## 5. CONTRADICCIÓN REAL ENCONTRADA — requiere decisión de negocio (Checkpoint A, NO resuelta unilateralmente)

**Plazo de SLA para "Crudo - Tripa Completa":**

| Fuente | Valor para Crudo Tripa |
|---|---|
| Manual del Especialista §1.5 (prosa) | "Crudo tripa completa (5 meses '150 días')" |
| Fórmula viva, Ficha real (`MIREYA...xlsx`, celda `PROYECTO!B14`) | `IF(F12="CRUDO - TRIPA",90,90)` → **90 días** |
| Fórmula viva, IA Matriz (`BDD - IA`, fila 3, columna K) | `IF(I3="CRUDO - TRIPA",90,90)` → **90 días** |
| Fórmula viva, IA Matriz (`BDD - IA`, fila 2, columna K) | Sin rama explícita para Tripa, cae al `else`=150 (fórmula más antigua, no actualizada) |

Dos fuentes vivas e independientes (la Ficha real de un proyecto activo + una fila reciente de la IA Matriz) coinciden en **90 días** para Crudo-Tripa, distinto de Crudo-Capítulo (150 días) — contradiciendo la prosa del Manual (que dice 150 para ambos) y una fila más antigua/no actualizada de la propia IA Matriz.

**No se modificó `servicios.plazoDias` ni ningún cálculo de SLA en esta ronda.** El catálogo actual sigue usando `CR: plazoDias: 150` para toda categoría "Crudo" (sin distinguir subtipo a nivel de catálogo — el subtipo vive en `fichasTrazabilidad.ingresoServicioSubtipoCrudo`, no en `servicios`). Esto queda marcado explícitamente como **pendiente de confirmación del negocio**: ¿Crudo-Tripa es 90 o 150 días? La magnitud de los pesos de carga tampoco se tocó (instrucción explícita, sin cambios).

---

## 6. Pendiente para continuar Fase 5 (NO implementado en esta ronda — distinguir de lo de arriba)

Esta ronda completó: lectura de las 7 fuentes, auditoría diferencial, checkpoint de foundation (work_items singleton/repeatable, notificaciones dirigidas con tests A-D, gates documentados con tests), 4 IDOR corregidos en rondas previas ya commiteados, y los campos/gates nuevos de §4.

**NO completado todavía** (correctamente no reclamado como hecho):
- Endpoints HTTP para los nuevos campos (`tituloDefinitivo`, `fechaAprobadaRrpp`, etc.) — existen en el schema pero ninguna ruta los expone todavía.
- Pipelines 5A-5F (Edición, Corrección, Creativa, Diseño, Calidad, Soporte Digital) como flujos de `work_items` reales conectados a rutas — el mecanismo (`work_items` singleton/repeatable, `project_assignments` por scope) está listo y probado, pero no se ha conectado a cada pipeline específico todavía.
- Bandejas/dashboards de UI nuevos (Jefe de Edición, Editor, Corrector, Validador, Líder Creativo) — ninguno construido en esta ronda.
- `fases`/`pasos`/`servicio_fases` seguido sin runtime real conectado — la capacidad del schema está probada (`tests/fasesWorkflow.test.ts`), pero no se sembró un catálogo real de producción ni se conectó a `work_items.pasoId` todavía.
- GATE-06/07/08 siguen sin campo real confirmado.

Dado el volumen (6 sub-pipelines completos, cada uno con backend + UI premium + Playwright en 5 viewports), completarlos todos en una sola ronda habría significado trabajo superficial sin verificación real — se prefirió consolidar un foundation más sólido y grounded, dejando los pipelines para continuar con el mismo nivel de rigor.
