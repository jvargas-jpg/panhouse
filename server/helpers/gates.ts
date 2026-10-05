// Reglas semánticas centralizadas — mismo patrón que preparacionComercial.ts
// (GATE-01, ya implementado ahí, no se reimplementa acá). Funciones
// puras sobre datos simples, consumidas tanto por rutas de escritura
// (para rechazar la acción si el gate no está desbloqueado) como,
// potencialmente, por el frontend — nunca duplicar la regla en React.
//
// Alcance de esta ronda: solo GATE-02 y GATE-03 (documentados abajo,
// con tests en tests/gates.test.ts). GATE-04 a GATE-08 (Título/Creativa,
// Portada/RRPP, Muestra de diagramación, Cierre de Calidad, Solvencia)
// se difieren a propósito — dependen de campos que o no existen
// todavía (ej. `solvenciaAdministrativa`, flags de aprobación de
// portada) o pertenecen a Corrección/Dirección Creativa. No se
// inventan esos campos solo para completar la lista de 8 gates; se
// documentan con fuente real en cuanto el pipeline correspondiente de
// Fase 5 los implemente.
//
// ┌─────────┬──────────────────────────┬───────────────────────────────────┬──────────────────────────────┬───────────────────────────────────────────┐
// │ Gate    │ Qué habilita             │ Campos requeridos                  │ Fuente documental              │ Tests                                      │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-02 │ Cálculo de Fecha de      │ servicioCodigo (proyectos.servicioId│ docs/auditoria/contradicciones-│ tests/gates.test.ts                        │
// │         │ Cierre; Jefatura puede   │ → servicios.codigo),               │ negocio.md §1 (Instructivo     │ "GATE-02"                                  │
// │         │ asignar especialista     │ ingresoServicioSubtipoCrudo         │ PED-INS-001)                   │                                             │
// │         │ (ver GATE-03, depende de │ (fichas_trazabilidad)               │                                 │                                             │
// │         │ este)                    │                                     │                                 │                                             │
// ├─────────┼──────────────────────────┼───────────────────────────────────┼──────────────────────────────┼───────────────────────────────────────────┤
// │ GATE-03 │ Primer contacto del      │ especialistaId (proyectos)         │ 02-business-flow.md Etapa 4     │ tests/gates.test.ts                        │
// │         │ Especialista con el      │                                     │ ("Primer Contacto Obligatorio") │ "GATE-03"                                  │
// │         │ autor; activación de     │                                     │                                 │                                             │
// │         │ subpipelines internos    │                                     │                                 │                                             │
// └─────────┴──────────────────────────┴───────────────────────────────────┴──────────────────────────────┴───────────────────────────────────────────┘

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
