// Reglas semánticas centralizadas — mismo patrón que preparacionComercial.ts
// (GATE-01, ya implementado ahí, no se reimplementa acá). Funciones
// puras sobre datos simples, consumidas tanto por rutas de escritura
// (para rechazar la acción si el gate no está desbloqueado) como,
// potencialmente, por el frontend — nunca duplicar la regla en React.
//
// Alcance acumulado (Fase 5): GATE-02 a GATE-08, cada uno con campo
// real confirmado y tests en tests/gates.test.ts. "Muestra de
// diagramación", "Cierre de Calidad" y "Solvencia" (candidatos
// originales a GATE-06/07/08 de una ronda anterior, antes de que esos
// números se reasignaran a Corrección/Dirección Creativa) siguen
// diferidos — sus campos todavía no tienen una columna real
// confirmada; no se inventan solo para completar una numeración.
//
// ┌─────────┬──────────────────────────┬───────────────────────────────────┬──────────────────────────────────┬───────────────────────────────────────────┐
// │ Gate    │ Qué habilita             │ Campos requeridos                  │ Fuente documental                  │ Tests                                      │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-02 │ Cálculo de Fecha de      │ servicioCodigo (proyectos.servicioId│ docs/auditoria/contradicciones-    │ tests/gates.test.ts                        │
// │         │ Cierre; Jefatura puede   │ → servicios.codigo),               │ negocio.md §1 (Instructivo         │ "GATE-02"                                  │
// │         │ asignar especialista     │ ingresoServicioSubtipoCrudo         │ PED-INS-001)                       │                                             │
// │         │ (ver GATE-03, depende de │ (fichas_trazabilidad)               │                                    │                                             │
// │         │ este)                    │                                     │                                    │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-03 │ Primer contacto del      │ especialistaId (proyectos)         │ 02-business-flow.md Etapa 4        │ tests/gates.test.ts                        │
// │         │ Especialista con el      │                                     │ ("Primer Contacto Obligatorio")    │ "GATE-03"                                  │
// │         │ autor; activación de     │                                     │                                    │                                             │
// │         │ subpipelines internos    │                                     │                                    │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-04 │ Solicitud/agendamiento   │ tituloDefinitivo, subtituloDefinitivo│ Manual del Especialista §2.3.3 y   │ tests/gates.test.ts                        │
// │         │ de la Reunión Creativa   │ (proyectos)                         │ §4.1; DIRECCIÓN CREATIVA.xlsx      │ "GATE-04"                                  │
// │         │                          │                                     │ (columna TÍTULO)                   │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-05 │ Envío de una propuesta   │ fechaAprobadaRrpp                  │ Manual del Especialista §4.1.2;    │ tests/gates.test.ts                        │
// │         │ de portada al autor      │ (ficha_diseno_propuestas, por fila) │ DIRECCIÓN CREATIVA.xlsx            │ "GATE-05"                                  │
// │         │                          │                                     │ ("PROPUESTAS ENVIADAS AL           │                                             │
// │         │                          │                                     │ ESPECIALISTA")                     │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-06 │ Asignación de corrector  │ requiereRevisionPrevia,            │ Manual del Especialista,           │ tests/gates.test.ts                        │
// │         │ (Fase 5, 5B Corrección)  │ revisionPreviaConfirmada            │ "Proceso de Corrección - Equipo    │ "GATE-06"                                  │
// │         │ cuando paginas > 120     │ (correcciones)                     │ Freelance" (tripas > 120 páginas)  │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-07 │ Solicitud de reunión     │ tituloDefinitivo/subtituloDefinitivo│ Manual del Especialista, update    │ tests/gates.test.ts                        │
// │         │ creativa (Fase 5, 5C) —  │ (GATE-04, reusado) + servicioCodigo │ "Solicitud de reunión creativa"    │ "GATE-07"                                  │
// │         │ reusa GATE-04 y suma el  │ + fechaFeedbackTripa (proyectos)   │                                    │                                             │
// │         │ momento según servicio   │                                     │                                    │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-08 │ Agregar conceptos de     │ fechaBriefAprobadoAutor            │ Manual del Especialista §4.1.1     │ tests/gates.test.ts                        │
// │         │ portada (Fase 5, 5C)    │ (direcciones_creativas)            │                                    │ "GATE-08"                                  │
// └─────────┴──────────────────────────┴───────────────────────────────────┴──────────────────────────────────┴───────────────────────────────────────────┘

export interface DatosGateDefinicionCrudo {
  servicioCodigo: string | null | undefined;
  ingresoServicioSubtipoCrudo: string | null | undefined;
}

export interface ResultadoGate {
  desbloqueado: boolean;
  motivo?: string;
}

// GATE-02 — Definición de Crudo: solo aplica cuando el servicio
// contratado es 'CR' (Crudo); para cualquier otro servicio el gate está
// trivialmente desbloqueado (no hay subtipo que definir). Mientras
// `servicioCodigo === 'CR'` y `ingresoServicioSubtipoCrudo` sea null,
// el proyecto queda "Pendiente de RRPP" — ver
// docs/auditoria/contradicciones-negocio.md §1.
export function evaluarGateDefinicionCrudo(datos: DatosGateDefinicionCrudo): ResultadoGate {
  if (datos.servicioCodigo !== 'CR') return { desbloqueado: true };
  if (!datos.ingresoServicioSubtipoCrudo) {
    return { desbloqueado: false, motivo: 'RRPP todavía no definió si el Crudo es Tripa o Capítulo' };
  }
  return { desbloqueado: true };
}

export interface DatosGateAsignacionFormal {
  especialistaId: string | null | undefined;
}

// GATE-03 — Asignación Formal: el proyecto no inicia contacto con el
// autor ni activa subpipelines hasta que Jefatura asigna especialista.
export function evaluarGateAsignacionFormal(datos: DatosGateAsignacionFormal): ResultadoGate {
  if (!datos.especialistaId) {
    return { desbloqueado: false, motivo: 'Jefatura todavía no asignó un especialista a este proyecto' };
  }
  return { desbloqueado: true };
}

export interface DatosGateTituloAprobado {
  tituloDefinitivo: string | null | undefined;
  subtituloDefinitivo: string | null | undefined;
}

// GATE-04 — Título y Subtítulo Aprobados: "Sin título no hay reunión
// creativa" (confirmado por 3 fuentes independientes — ver el
// comentario de proyectos.tituloDefinitivo en server/db/schema/proyectos.ts).
// Subtítulo se trata igual de estricto que título: el Manual no admite
// una reunión creativa con solo uno de los dos cerrados.
export function evaluarGateTituloAprobado(datos: DatosGateTituloAprobado): ResultadoGate {
  if (!datos.tituloDefinitivo?.trim() || !datos.subtituloDefinitivo?.trim()) {
    return { desbloqueado: false, motivo: 'El título y subtítulo definitivos todavía no están cerrados' };
  }
  return { desbloqueado: true };
}

export interface DatosGateAprobacionPortadaRrpp {
  fechaAprobadaRrpp: string | null | undefined;
}

// GATE-05 — Aprobación Interna de Portada: las propuestas del Líder
// Creativo NO van directo al autor — RRPP (Paola Morales) debe
// aprobarlas primero (Manual del Especialista §4.1.2, confirmado
// también en DIRECCIÓN CREATIVA.xlsx). Opera por PROPUESTA individual
// (ficha_diseno_propuestas), no a nivel de proyecto — cada fila de
// propuesta tiene su propia fechaAprobadaRrpp.
export function evaluarGateAprobacionPortadaRrpp(datos: DatosGateAprobacionPortadaRrpp): ResultadoGate {
  if (!datos.fechaAprobadaRrpp) {
    return { desbloqueado: false, motivo: 'RRPP todavía no aprobó internamente esta propuesta de portada' };
  }
  return { desbloqueado: true };
}

export interface DatosGateRevisionPreviaCorreccion {
  requiereRevisionPrevia: boolean;
  revisionPreviaConfirmada: boolean;
}

// GATE-06 — Revisión Previa de Tripas Extensas (Fase 5, 5B Corrección):
// "toda tripa que exceda las 120 páginas en Word deberá ser revisada
// previamente antes de su asignación a corrección" (Manual del
// Especialista, actualización "Proceso de Corrección - Equipo
// Freelance"). requiereRevisionPrevia es un snapshot fijado al
// solicitar la corrección (paginas > 120 en ese momento, ver
// server/helpers/correccionSla.ts) — este gate solo exige la
// confirmación explícita del Especialista, nunca recalcula el costo
// (el Manual no lo define con una fórmula).
export function evaluarGateRevisionPreviaCorreccion(datos: DatosGateRevisionPreviaCorreccion): ResultadoGate {
  if (datos.requiereRevisionPrevia && !datos.revisionPreviaConfirmada) {
    return { desbloqueado: false, motivo: 'Esta tripa supera las 120 páginas — requiere revisión previa antes de asignar corrector' };
  }
  return { desbloqueado: true };
}

export interface DatosGateMomentoReunionCreativa extends DatosGateTituloAprobado {
  // 'CR' (Crudo) y 'EF' (Escritura fantasma/Ghost) comparten el mismo
  // momento real (Manual, actualización de reuniones: "En servicios de
  // crudo y ghost, debe solicitarse junto con el feedback de tripa
  // completa"); 'SE' (Sello editorial) se programa desde el ingreso,
  // sin depender de ese feedback ("al momento del ingreso del autor se
  // coordina la reunión operativa y, en ese mismo espacio, se programa
  // la creativa"). Cualquier otro código se trata como Sello (sin
  // dependencia adicional) — no hay evidencia de un tercer régimen.
  servicioCodigo: string | null | undefined;
  fechaFeedbackTripa: string | null | undefined;
}

const CODIGOS_SERVICIO_CON_FEEDBACK_TRIPA_REQUERIDO = ['CR', 'EF'];

// GATE-07 — Momento de Activación de la Reunión Creativa (Fase 5, 5C):
// reutiliza GATE-04 (título/subtítulo definitivos) sin reimplementar esa
// lógica — "SIN TÍTULO NO HAY REUNIÓN CREATIVA" sigue siendo la regla
// base para TODOS los servicios. Crudo/Ghost suman una segunda
// condición real: no puede solicitarse antes del feedback de tripa
// completa (proyectos.fechaFeedbackTripa, ya registrado por 5A). Sello
// no tiene esa segunda condición — confirmado contra el Manual, no
// asumido por omisión.
export function evaluarGateMomentoReunionCreativa(datos: DatosGateMomentoReunionCreativa): ResultadoGate {
  const gateTitulo = evaluarGateTituloAprobado(datos);
  if (!gateTitulo.desbloqueado) return gateTitulo;

  if (CODIGOS_SERVICIO_CON_FEEDBACK_TRIPA_REQUERIDO.includes(datos.servicioCodigo ?? '') && !datos.fechaFeedbackTripa) {
    return { desbloqueado: false, motivo: 'En Crudo/Ghost, la reunión creativa se solicita junto con el feedback de tripa completa, que todavía no se registró' };
  }

  return { desbloqueado: true };
}

export interface DatosGateBriefAprobadoParaConceptos {
  fechaBriefAprobadoAutor: string | null | undefined;
}

// GATE-08 — Brief Aprobado Requerido para Conceptos (Fase 5, 5C):
// Manual §4.1.1: "Al recibir la aprobación del autor se le informa por
// el correo al líder creativo para que pueda iniciar con la
// conceptualización de las portadas" — los conceptos nunca empiezan
// antes de esa aprobación.
export function evaluarGateBriefAprobadoParaConceptos(datos: DatosGateBriefAprobadoParaConceptos): ResultadoGate {
  if (!datos.fechaBriefAprobadoAutor) {
    return { desbloqueado: false, motivo: 'El autor todavía no aprobó el brief creativo — no se pueden agregar conceptos de portada' };
  }
  return { desbloqueado: true };
}
