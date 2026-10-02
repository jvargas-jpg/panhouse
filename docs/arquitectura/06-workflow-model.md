# Documento 06 — Modelo de Workflow, Paralelismo y Compuertas de Calidad (Gates)
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  

---

## 1. Separación de Conceptos: Estado Macro vs. Etapa vs. Work Item

Uno de los errores más graves en sistemas de gestión de procesos editoriales es reducir el estado del proyecto a un único enum plano (por ejemplo: `estado = 'en_correccion'`). Esto falla porque mientras un manuscrito está en corrección ortotipográfica, en paralelo se puede estar gestionando la reunión creativa, la cuenta de Amazon en soporte digital y la planificación de ferias en RRPP.

PanHouse Gestor Editorial separa formalmente tres niveles:

```
+-----------------------------------------------------------------------------------+
| 1. ESTADO MACRO DEL PROYECTO (Salud / Condición Legal y Operativa)                |
|    en_proceso | retrasado | stand_by | pausado | culminado | retirado            |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 2. ETAPA OPERATIVA GLOBAL (Fase Macro de la Trazabilidad)                         |
|    1. Ingreso & Perfil | 2. Edición | 3. Corrección | 4. Creativa & Diseño        |
|    5. Calidad (Fases 1-4) | 6. Soporte Digital | 7. Lanzamiento | 8. Paquete Final|
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 3. WORK ITEMS ACTIVOS (Tareas Operativas Concurrente y Paralelas)                |
|    - [Edición] Capítulo 3 editado por Editor          (Estado: En progreso)       |
|    - [Diseño]  Muestra de diagramación                (Estado: Completado)        |
|    - [Creativa] Conceptos de portada en revisión RRPP (Estado: Bloqueado por gate)|
|    - [Digital] Formulario de Amazon enviado al autor  (Estado: En progreso)       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Abstracción de Work Items (Tareas Operativas)

Para modelar las actividades sin necesidad de un motor BPM pesado (como Camunda), el sistema implementa una entidad ligera y estructurada de **Work Item**:

```typescript
export interface WorkItem {
  id: string;
  proyectoId: string;
  tipo: TipoWorkItem;
  titulo: string;
  responsableRol: Rol;
  responsableUserId: string | null;
  estado: 'pendiente' | 'en_progreso' | 'bloqueado' | 'completado' | 'cancelado';
  gateBloqueante?: string; // ID o código de la compuerta que lo condiciona
  fechaInicioPautada?: string;
  fechaFinPautada?: string;
  fechaInicioReal?: string;
  fechaFinReal?: string;
  metadata?: Record<string, unknown>; // Parámetros específicos de la actividad
  createdAt: Date;
  updatedAt: Date;
}
```

### Tipos de Work Items Principales:
- `INTAKE_COMERCIAL`: Completitud de datos contractuales.
- `INTAKE_RRPP`: Diagnóstico inicial, asignación de colección y subtipo de Crudo.
- `ASIGNACION_ESPECIALISTA`: Asignación en Jefatura de Área.
- `EDICION_CAPITULO`: Edición de capítulo $N$ (SLA: 3 días hábiles).
- `FEEDBACK_AUTOR_CAPITULO`: Revisión del autor (SLA: 3 días hábiles).
- `APLICACION_FEEDBACK_EDICION`: Ajustes del editor tras retorno del autor.
- `SOLICITUD_REUNION_CREATIVA`: Activada tras el Gate de Título.
- `CREACION_BRIEF`: Elaboración del brief por el Líder Creativo (1 día).
- `CONCEPTUALIZACION_PORTADAS`: 2-3 propuestas de portada.
- `APROBACION_PORTADA_RRPP`: Gate de validación interna por Paola Morales.
- `ELECCION_PORTADA_AUTOR`: Decisión del autor en su portal.
- `MUESTRA_DIAGRAMACION`: Maquetación de 3 capítulos por Diseñador (3 días).
- `CORRECCION_ORTOTIPOGRAFICA`: Corrección externa freelance en Word (5 días continuos).
- `DIAGRAMACION_V1`: Maquetación completa de la tripa (5 / 15 días).
- `CUBIERTA_EXTENDIDA`: Maquetación de cubierta completa (3 días).
- `VERIFICACION_CUBIERTA_LIDER_CREATIVO`: Chequeo de fidelidad con el concepto.
- `CALIDAD_FASE_1`: Primera revisión formal de calidad sobre PDF (1 día).
- `CALIDAD_VALIDACION_CAMBIOS`: Rondas F2.1 a F2.5 de aplicación de comentarios de diseño.
- `CALIDAD_REVISION_FINAL`: Fase 3 tras visto bueno del autor y números legales.
- `AMAZON_CREACION_CUENTA`: Formulario y cuenta KDP en Soporte Digital (inicia en Fase 1).
- `AMAZON_DEFINICION_CRITERIOS`: Precios, tipo de papel, tapa blanda y Kindle.
- `SOLVENCIA_ADMINISTRATIVA`: Certificación de Cobranzas previo a liberación.
- `PAQUETE_FINAL_COMPILACION`: Generación de artes finales y editables.
- `AMAZON_CARGA_OFICIAL`: Publicación en vivo tras solvencia y paquete final.

---

## 3. Catálogo de Compuertas de Decisión (Gates)

Las compuertas garantizan que ninguna etapa crítica inicie sobre insumos incompletos o defectuosos:

| Código de Gate | Nombre del Gate | Condición de Desbloqueo | Área Responsable | Impacto en Caso de Incumplimiento |
|---|---|---|---|---|
| **GATE-01** | *Listo para RRPP* | Todos los campos contractuales requeridos completos (`ingresoFechaIngreso`, `capitulosPactados`, `paginasPactadas`, `unidadId`, `presupuestoId`, `ingresoServicioEjecucion`, `ingresoServicioAlianza`). | `comercial` | RRPP no recibe el proyecto para diagnóstico y el proyecto permanece en lista de pendientes comerciales. |
| **GATE-02** | *Definición de Crudo* | Subtipo Crudo (`ingresoServicioSubtipoCrudo`) definido obligatoriamente como `Capítulo` o `Tripa`. | `rrpp` | La Fecha de Cierre Proyectada no se calcula y Jefatura no puede asignar Especialista. |
| **GATE-03** | *Asignación Formal* | `especialistaId` asignado por Jefatura mediante análisis de carga ponderada. | `jefe_area` | El proyecto permanece en "Pendiente de Asignación"; no se inicia el contacto con el autor. |
| **GATE-04** | *Título y Subtítulo Aprobados* | Título y subtítulo definitivos cerrados y aprobados formalmente por autor y especialista. | `especialista` / `autor` | **Bloquea estrictamente la solicitud y agendamiento de la Reunión Creativa.** |
| **GATE-05** | *Aprobación Interna de Portada* | Conceptos de portada aprobados internamente por RRPP (Paola Morales). | `rrpp` | **Las portadas NO se envían al autor** hasta contar con el visto bueno de RRPP. |
| **GATE-06** | *Aprobación de Muestra de Diagramación* | Autor aprueba formalmente el estilo gráfico de los primeros 3 capítulos. | `autor` | El diseñador no puede proceder con la maquetación de la tripa completa. |
| **GATE-07** | *Cierre de Iteraciones de Calidad* | Validador certifica 0 comentarios pendientes de aplicación en la versión actual. | `soporte_editorial` | El archivo no se envía a revisión final ni se tramitan números legales. |
| **GATE-08** | *Solvencia Administrativa* | Cobranzas certifica solvencia administrativa o condición de patrocinado. | `cobranzas` | **Bloqueo estricto:** Diseñador y Especialista no pueden entregar el Paquete Final al autor y Soporte Digital no puede publicar en Amazon. |

---

## 4. Paralelismo Real de Actividades

El sistema activa ramas concurrentes en momentos específicos de la evolución del proyecto:

1. **Rama Creativa en Paralelo con Edición:**
   - En proyectos EF o Crudo por Capítulos, en cuanto se aprueba el Título (usualmente entre feedback de capítulo 3 o 4), se dispara la Reunión Creativa, Brief y conceptos de portada mientras el editor continúa redactando o editando los capítulos restantes.
2. **Rama Soporte Digital en Paralelo con Calidad:**
   - En el instante en que el diseñador entrega la V1 y el Especialista la despacha a Fase 1 de Calidad, **se genera automáticamente el work-item de Soporte Digital**. Soporte Digital gestiona formularios, cuenta y precios con el autor simultáneamente a las revisiones de maquetación de Calidad.
3. **Rama RRPP Lanzamiento en Paralelo con Producción:**
   - La planificación de ferias y eventos se activa en base a hitos de avance (Capítulo 4 en Ghostwriting / Tripa completa en EET / Asignación de diseño en SE), sin esperar a la finalización del libro.

---

## 5. Auditoría de Eventos (Audit Log) vs. Sistema de Notificaciones

Se desacoplan conceptualmente en dos mecanismos:
- **Audit Log (Historial Inmutable):**
  - Registra: *Quién*, *Qué acción*, *Cuándo*, *Sobre qué proyecto* y *Snapshot de cambios*.
  - No es consumido como bandeja de entrada, sino como pista de auditoría inmutable para reconstruir cualquier transición histórica.
- **Notificaciones (Bandeja Operativa):**
  - Representa: Tareas pendientes o eventos que requieren atención inmediata de un rol específico.
  - Posee estado `leido = boolean`, destinatario por rol o usuario, y enlace directo al proyecto.
