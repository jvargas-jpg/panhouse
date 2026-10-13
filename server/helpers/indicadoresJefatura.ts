import { db, pool } from '../db/client.js';
import { projectAssignments, users } from '../db/schema/index.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { obtenerDashboardJefatura, ordenarCandidatos } from './jefatura.js';
import { calcularCarga, ESTADOS_ACTIVOS } from './carga.js';
import { obtenerIntervencionesIndicadores } from './seguimientoIntervenciones.js';
import { ventanaRrpp } from './rrppIndicadores.js';
import { ESTADOS_INDICADOR } from '../../shared/indicadoresJefatura.js';
import type {
  DistribucionIndicador,
  EspecialistaIndicador,
  FiltrosIndicadoresJefatura,
  IndicadoresJefatura,
  ProyectoIndicador,
  SlaIndicador,
} from '../../shared/indicadoresJefatura.js';
import type { IntervencionSeguimiento } from '../../shared/seguimientoOperativo.js';

const dia = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
const round = (n: number) => Math.round(n * 10) / 10;
interface HechoProyecto {
  id: string;
  ingreso: string | null;
  cierre: string | null;
  cierre_especialista_id: string | null;
}
export function resumirSlaIndicador(
  rows: IntervencionSeguimiento[],
): SlaIndicador {
  const medibles = rows.filter(
    (r) => r.tiempos.entregado && r.tiempos.vence && r.sla.cumplimiento,
  );
  const enPlazo = medibles.filter(
    (r) => r.sla.cumplimiento === 'en_plazo',
  ).length;
  const tiempos = rows.flatMap((r) =>
    !r.tiempos.entregado || r.tiempos.horasEfectivas === null
      ? []
      : [r.tiempos.horasEfectivas],
  );
  return {
    entregas: rows.length,
    medibles: medibles.length,
    enPlazo,
    fueraPlazo: medibles.length - enPlazo,
    cumplimiento: medibles.length
      ? round((enPlazo * 100) / medibles.length)
      : null,
    promedioHoras: tiempos.length
      ? round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
      : null,
    muestrasTiempo: tiempos.length,
  };
}

export async function obtenerIndicadoresJefatura(
  f: FiltrosIndicadoresJefatura,
  ahora = new Date(),
): Promise<IndicadoresJefatura> {
  const v = ventanaRrpp(f, dia(ahora));
  const snapshot = await obtenerDashboardJefatura(ahora, {
    historico: true,
    incluirRetirados: true,
  });
  const base = snapshot.proyectos;
  const universo = base.filter(
    (p) =>
      (!f.servicioId || p.servicio.id === f.servicioId) &&
      (!f.estado || p.estado === f.estado) &&
      (!f.prioridad ||
        (f.prioridad === 'normal'
          ? ['normal', 'normal_confirmado'].includes(p.express.estado)
          : p.express.estado === f.prioridad)),
  );
  const seleccionados = universo.filter(
    (p) =>
      !f.especialistaId ||
      (f.especialistaId === 'sin_asignar'
        ? !p.especialista
        : p.especialista?.id === f.especialistaId),
  );
  const seleccionIds = new Set(seleccionados.map((p) => p.id));
  const ids = universo.map((p) => p.id);
  const [facts, assignments, personas, intervenciones] = await Promise.all([
    ids.length
      ? pool.query<HechoProyecto>(
          `SELECT p.id,
      (SELECT min(a.created_at)::text FROM audit_logs a WHERE a.proyecto_id=p.id AND a.accion='JEFATURA_NOTIFICADA' AND a.created_at <= $2::timestamptz) ingreso,
      cierre.created_at::text cierre, cierre.detalles->>'especialistaId' cierre_especialista_id
      FROM proyectos p LEFT JOIN LATERAL (SELECT a.created_at,a.detalles FROM audit_logs a
        WHERE a.proyecto_id=p.id AND a.accion='PROYECTO_ESTADO_CAMBIADO' AND a.detalles->>'nuevo'='culminado' AND a.created_at <= $2::timestamptz
        ORDER BY a.created_at,a.id LIMIT 1) cierre ON true WHERE p.id=ANY($1::uuid[])`,
          [ids, ahora.toISOString()],
        )
      : { rows: [] as HechoProyecto[] },
    ids.length
      ? db
          .select()
          .from(projectAssignments)
          .where(
            and(
              inArray(projectAssignments.proyectoId, ids),
              eq(projectAssignments.tipo, 'especialista'),
              isNull(projectAssignments.workItemId),
            ),
          )
      : [],
    db
      .select({
        id: users.id,
        nombre: users.nombre,
        activo: users.activo,
        rol: users.rol,
      })
      .from(users),
    obtenerIntervencionesIndicadores(
      seleccionados.map((p) => p.id),
      ahora,
    ),
  ]);
  const hechos = new Map(facts.rows.map((r) => [r.id, r]));
  const dentro = (fecha: string | Date | null, from: string, to: string) =>
    !!fecha &&
    new Date(fecha).getTime() <= ahora.getTime() &&
    dia(new Date(fecha)) >= from &&
    dia(new Date(fecha)) <= to;
  const activos = seleccionados.filter((p) =>
    ESTADOS_ACTIVOS.includes(p.estado as (typeof ESTADOS_ACTIVOS)[number]),
  );
  const culminadosSinFecha = seleccionados.filter(
    (p) => p.estado === 'culminado' && !hechos.get(p.id)?.cierre,
  ).length;
  const hayCierres = facts.rows.some((r) => r.cierre);
  const cierresDisponibles = hayCierres || culminadosSinFecha === 0;
  const cierreDePersona = (r: HechoProyecto) =>
    !f.especialistaId ||
    (f.especialistaId === 'sin_asignar'
      ? !r.cierre_especialista_id && seleccionIds.has(r.id)
      : r.cierre_especialista_id === f.especialistaId);
  const asignacionDePersona = (a: (typeof assignments)[number]) =>
    !f.especialistaId ||
    (f.especialistaId !== 'sin_asignar' && a.usuarioId === f.especialistaId);
  const actividad = (from: string, to: string) => ({
    ingresos: facts.rows.filter(
      (r) => seleccionIds.has(r.id) && dentro(r.ingreso, from, to),
    ).length,
    asignaciones: assignments.filter(
      (a) => asignacionDePersona(a) && dentro(a.asignadoEn, from, to),
    ).length,
    cierres: cierresDisponibles
      ? facts.rows.filter(
          (r) => cierreDePersona(r) && dentro(r.cierre, from, to),
        ).length
      : null,
  });
  const enPeriodo = actividad(f.from, f.to);
  const entregas = intervenciones.filter(
    (r) =>
      r.estado === 'entregado' &&
      (r.tiempos.entregado
        ? dentro(r.tiempos.entregado, f.from, f.to)
        : !!r.tiempos.fechaEntrega &&
          r.tiempos.fechaEntrega >= f.from &&
          r.tiempos.fechaEntrega <= f.to &&
          r.tiempos.fechaEntrega <= dia(ahora)),
  );
  const persona = new Map(personas.map((u) => [u.id, u]));
  const detalle = universo.filter(
    (p) =>
      seleccionIds.has(p.id) ||
      (hechos.get(p.id)?.cierre &&
        cierreDePersona(hechos.get(p.id)!) &&
        dentro(hechos.get(p.id)!.cierre, f.from, f.to)),
  );
  const proyectos: ProyectoIndicador[] = detalle.map((p) => {
    const h = hechos.get(p.id);
    return {
      id: p.id,
      codigo: p.codigo,
      titulo: p.titulo ?? p.autores,
      autores: p.autores,
      servicio: p.servicio.nombre,
      estado: p.estado as ProyectoIndicador['estado'],
      especialistaId: p.especialista?.id ?? null,
      especialistaNombre: p.especialista?.nombre ?? null,
      cierreEspecialistaId: h?.cierre_especialista_id ?? null,
      cierreEn: h?.cierre ? new Date(h.cierre).toISOString() : null,
      activo:
        seleccionIds.has(p.id) &&
        ESTADOS_ACTIVOS.includes(p.estado as (typeof ESTADOS_ACTIVOS)[number]),
      peso: p.servicio.peso,
      enRiesgo: p.riesgo.atencion,
      vencido: p.riesgo.vencido,
      margenDias:
        p.datoIncompleto ||
        !ESTADOS_ACTIVOS.includes(p.estado as (typeof ESTADOS_ACTIVOS)[number])
          ? null
          : round(p.riesgo.diasRestantes),
      diasEfectivos: ESTADOS_ACTIVOS.includes(
        p.estado as (typeof ESTADOS_ACTIVOS)[number],
      )
        ? round(p.riesgo.diasEfectivos)
        : null,
      express: p.express.estado,
    };
  });
  const equipoIds = new Set(
    personas
      .filter(
        (u) =>
          u.rol === 'especialista' &&
          u.activo &&
          (!f.especialistaId || u.id === f.especialistaId),
      )
      .map((u) => u.id),
  );
  for (const p of proyectos) {
    if (!f.especialistaId && p.especialistaId) equipoIds.add(p.especialistaId);
    if (
      p.cierreEspecialistaId &&
      (!f.especialistaId || p.cierreEspecialistaId === f.especialistaId) &&
      dentro(p.cierreEn, f.from, f.to)
    )
      equipoIds.add(p.cierreEspecialistaId);
  }
  const equipo: EspecialistaIndicador[] = [...equipoIds]
    .map((id) => {
      const own = proyectos.filter((p) => p.activo && p.especialistaId === id),
        u = persona.get(id);
      const desconocidos = proyectos.some(
        (p) =>
          p.estado === 'culminado' && !p.cierreEn && p.especialistaId === id,
      );
      return {
        id,
        nombre: u?.nombre ?? 'Especialista registrado',
        habilitado: u?.activo === true && u.rol === 'especialista',
        activos: own.length,
        carga: calcularCarga(own.map((p) => p.peso)),
        express: own.filter((p) => p.express === 'confirmado').length,
        enRiesgo: own.filter((p) => p.enRiesgo).length,
        vencidos: own.filter((p) => p.vencido).length,
        cierres:
          desconocidos && !hayCierres
            ? null
            : proyectos.filter(
                (p) =>
                  p.cierreEspecialistaId === id &&
                  dentro(p.cierreEn, f.from, f.to),
              ).length,
        asignaciones: assignments.filter(
          (a) => a.usuarioId === id && dentro(a.asignadoEn, f.from, f.to),
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.carga - a.carga ||
        b.enRiesgo - a.enRiesgo ||
        a.nombre.localeCompare(b.nombre, 'es') ||
        a.id.localeCompare(b.id),
    );
  const candidato = ordenarCandidatos(
    equipo.filter((e) => e.habilitado).map((e) => ({ ...e, servicios: [] })),
  )[0];
  const agrupar = (
    filas: typeof activos,
    key: (p: (typeof activos)[number]) => [string, string],
  ): DistribucionIndicador[] => {
    const groups = new Map<string, DistribucionIndicador>();
    for (const p of filas) {
      const [id, nombre] = key(p);
      const row = groups.get(id) ?? { id, nombre, cantidad: 0, carga: 0 };
      row.cantidad++;
      row.carga = calcularCarga([row.carga, p.servicio.peso]);
      groups.set(id, row);
    }
    return [...groups.values()].sort(
      (a, b) =>
        b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'),
    );
  };
  const labels: Record<string, string> = {
    confirmado: 'Express confirmado',
    posible: 'Express por confirmar',
    normal: 'Normal',
    normal_confirmado: 'Normal',
    pendiente_clasificacion: 'Prioridad sin clasificar',
  };
  const meses = Array.from({ length: 12 }, (_, i) => {
    const end = new Date(`${f.to}T12:00:00Z`);
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + i, 1),
    );
    const to = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);
    return {
      clave: start.toISOString().slice(0, 7),
      mes: new Intl.DateTimeFormat('es-VE', {
        month: 'short',
        timeZone: 'UTC',
      }).format(start),
      ...actividad(start.toISOString().slice(0, 10), to),
    };
  });
  const etapaNombres: Record<string, string> = {
    correccion: 'Corrección',
    fase_calidad_1: 'Fase de Calidad 1',
    revision_final: 'Revisión final',
    validacion: 'Validación',
  };
  return {
    actualizadoEn: ahora.toISOString(),
    periodo: {
      from: f.from,
      to: f.to,
      anteriorFrom: v.anteriorFrom,
      anteriorTo: v.anteriorTo,
      zonaHoraria: 'America/Caracas',
    },
    resumen: {
      activos: activos.length,
      porAsignar: activos.filter((p) => p.porAsignar).length,
      enRiesgo: activos.filter((p) => p.riesgo.atencion).length,
      express: activos.filter((p) => p.express.estado === 'confirmado').length,
      expressPosibles: activos.filter((p) => p.express.estado === 'posible')
        .length,
      cargaEquipo: calcularCarga(
        activos.filter((p) => p.especialista).map((p) => p.servicio.peso),
      ),
      cargaSinAsignar: calcularCarga(
        activos.filter((p) => !p.especialista).map((p) => p.servicio.peso),
      ),
      cierres: enPeriodo.cierres,
    },
    actividad: {
      ...enPeriodo,
      anterior: actividad(v.anteriorFrom, v.anteriorTo),
    },
    cobertura: {
      ingresosSinFecha: seleccionados.filter(
        (p) => p.entregadoJefatura && !hechos.get(p.id)?.ingreso,
      ).length,
      culminadosSinFecha,
      cierresSinResponsable: facts.rows.filter(
        (r) =>
          cierreDePersona(r) &&
          dentro(r.cierre, f.from, f.to) &&
          !r.cierre_especialista_id,
      ).length,
      sinPlazo: activos.filter((p) => p.datoIncompleto).length,
    },
    meses,
    servicios: agrupar(activos, (p) => [
      `${p.servicio.id}:${p.subtipoCrudo ?? ''}`,
      p.servicio.nombre,
    ]),
    estados: agrupar(activos, (p) => [
      p.estado,
      ESTADOS_INDICADOR[p.estado as keyof typeof ESTADOS_INDICADOR],
    ]),
    prioridades: agrupar(activos, (p) => [
      p.express.estado === 'normal_confirmado' ? 'normal' : p.express.estado,
      labels[p.express.estado]!,
    ]),
    equipo,
    menorCargaId: candidato?.id ?? null,
    sla: resumirSlaIndicador(entregas),
    etapas: Object.entries(etapaNombres).map(([id, nombre]) => ({
      id,
      nombre,
      sla: resumirSlaIndicador(entregas.filter((r) => r.proceso === id)),
    })),
    proyectos,
    catalogos: {
      servicios: [
        ...new Map(
          base.map((p) => [
            p.servicio.id,
            {
              id: p.servicio.id,
              nombre: p.servicio.nombreCatalogo ?? p.servicio.nombre,
            },
          ]),
        ).values(),
      ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      especialistas: personas
        .filter(
          (u) =>
            u.rol === 'especialista' ||
            base.some((p) => p.especialista?.id === u.id),
        )
        .map((u) => ({ id: u.id, nombre: u.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    },
  };
}

const celdaCsv = (value: string | number | null) => {
  const text = String(value ?? 'Sin datos suficientes');
  return `"${(/^[\s]*[=+\-@]/.test(text) && typeof value === 'string' ? "'" : '') + text.replaceAll('"', '""')}"`;
};
export function csvIndicadoresJefatura(data: IndicadoresJefatura) {
  const rows: (string | number | null)[][] = [
    [
      'Especialista',
      'Habilitado',
      'Activos actuales',
      'Carga ponderada actual',
      'Express confirmados',
      'En riesgo',
      'Vencidos',
      'Cierres registrados en período',
      'Asignaciones en período',
      'Desde',
      'Hasta',
    ],
    ...data.equipo.map((e) => [
      e.nombre,
      e.habilitado ? 'Sí' : 'No',
      e.activos,
      e.carga,
      e.express,
      e.enRiesgo,
      e.vencidos,
      e.cierres,
      e.asignaciones,
      data.periodo.from,
      data.periodo.to,
    ]),
  ];
  return (
    '\uFEFF' +
    rows.map((row) => row.map(celdaCsv).join(',')).join('\r\n') +
    '\r\n'
  );
}
