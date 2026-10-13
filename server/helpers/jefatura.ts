import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  auditLogs,
  autores,
  correcciones,
  direccionesCreativas,
  disenos,
  disenoVersiones,
  fichaCalidadFases,
  fichasTrazabilidad,
  pausas,
  projectAssignments,
  proyectos,
  servicios,
  users,
  workItems,
} from '../db/schema/index.js';
import type {
  ActividadJefatura,
  CapacidadJefatura,
  DashboardJefatura,
  ExpressJefatura,
  ProyectoJefatura,
  SolicitudJefatura,
} from '../../shared/jefatura.js';
import {
  ESTADOS_ACTIVOS,
  calcularCarga,
  resolverEspecialistaActual,
  especialistaActualSql,
} from './carga.js';
import { calcularCronograma, resolverPlazosServicio, type PlazosServicio } from './cronograma.js';
import { resumenDecisiones } from './decisiones.js';
import { nombreServicioProyecto } from '../../shared/planificacion.js';
import {
  determinarDiasPlazoAlerta,
  evaluarRiesgo,
  type RiesgoProyecto,
} from './alertas.js';
import { calcularDuracionEfectivaDias } from './performance.js';
import { obtenerAutoresPorProyectos } from './proyectosAutores.js';
import { registrarEvento } from './auditLog.js';
import { evaluarPlazoCorreccion } from './correccionSla.js';
import { plazoDiseno } from './disenoSla.js';

const fecha = (v: string) => new Date(`${v}T00:00:00Z`);
type Decision = Pick<
  typeof proyectos.$inferSelect,
  | 'fechaProgramadaInicio'
  | 'fechaDeseadaAutor'
  | 'expressDecision'
  | 'expressFechaEstandar'
  | 'expressFechaDeseada'
  | 'expressDecididoEn'
  | 'expressMotivo'
>;
export function evaluarExpressJefatura(
  p: Decision,
  servicio: PlazosServicio,
  deseadaFicha: string | null = null,
  subtipo: string | null = null,
  ingreso: string | null = null,
): ExpressJefatura {
  const fechaDeseada = deseadaFicha ?? p.fechaDeseadaAutor;
  const plazo = resolverPlazosServicio(servicio, subtipo);
  if (!plazo) return { estado: 'pendiente_clasificacion', fechaEstandar: null, fechaDeseada, compresionDias: 0, plazoBaseDias: null, decididoEn: null, motivo: null };
  const cronograma = calcularCronograma(
    plazo,
    fecha(ingreso ?? p.fechaProgramadaInicio),
    fechaDeseada ? fecha(fechaDeseada) : null,
  );
  const fechaEstandar = cronograma.fechaFinComprometida
    .toISOString()
    .slice(0, 10);
  const compresionDias = fechaDeseada
    ? Math.max(
        0,
        Math.round(
          (fecha(fechaEstandar).getTime() - fecha(fechaDeseada).getTime()) /
            86400000,
        ),
      )
    : 0;
  const vigente =
    p.expressFechaEstandar === fechaEstandar &&
    p.expressFechaDeseada === fechaDeseada;
  return {
    plazoBaseDias: plazo.plazoComercialDias ?? plazo.plazoDias,
    fechaEstandar,
    fechaDeseada,
    compresionDias,
    estado: !cronograma.esExpress
      ? 'normal'
      : vigente && p.expressDecision === 'confirmado'
        ? 'confirmado'
        : vigente && p.expressDecision === 'normal'
          ? 'normal_confirmado'
          : 'posible',
    decididoEn: vigente ? (p.expressDecididoEn?.toISOString() ?? null) : null,
    motivo: vigente ? p.expressMotivo : null,
  };
}

export function evaluarAtencionJefatura(
  riesgo: RiesgoProyecto,
  estado: string,
  procesos: ProyectoJefatura['procesos'],
) {
  const causas: string[] = [];
  if (riesgo.vencido) causas.push('Plazo operativo excedido');
  else if (riesgo.enRiesgo) causas.push('80% del plazo operativo consumido');
  if (estado === 'retrasado') causas.push('Proyecto marcado como retrasado');
  if (procesos.some((p) => p.vencido))
    causas.push('Proceso con vencimiento excedido');
  if (procesos.some((p) => p.estado === 'bloqueado'))
    causas.push('Proceso bloqueado');
  return {
    atencion: causas.length > 0,
    causas,
    vencido: riesgo.vencido || procesos.some((p) => p.vencido),
    diasRestantes: riesgo.diasRestantes,
    diasEfectivos: riesgo.diasEfectivosTranscurridos,
  };
}

export function ordenarCandidatos(
  equipo: CapacidadJefatura[],
): CapacidadJefatura[] {
  return [...equipo].sort(
    (a, b) =>
      a.carga - b.carga ||
      a.enRiesgo - b.enRiesgo ||
      a.express - b.express ||
      a.nombre.localeCompare(b.nombre, 'es') ||
      a.id.localeCompare(b.id),
  );
}
export function recomendarEspecialista(equipo: CapacidadJefatura[]) {
  const orden = ordenarCandidatos(equipo);
  const primero = orden[0];
  if (!primero) return null;
  const mismaCarga = orden.filter((c) => c.carga === primero.carga);
  const razones = [
    `Carga ponderada mínima del equipo: ${primero.carga} puntos.`,
  ];
  if (mismaCarga.some((c) => c.enRiesgo > primero.enRiesgo))
    razones.push(
      `En igualdad de carga, menos proyectos en riesgo: ${primero.enRiesgo}.`,
    );
  else if (
    mismaCarga
      .filter((c) => c.enRiesgo === primero.enRiesgo)
      .some((c) => c.express > primero.express)
  )
    razones.push(
      `En igualdad de carga y riesgo, menos Express confirmados: ${primero.express}.`,
    );
  else if (mismaCarga.length > 1)
    razones.push(
      'Empate operativo; orden estable por nombre. Puedes elegir otro especialista.',
    );
  if (primero.activos === 0) razones.push('Sin proyectos activos asignados.');
  return { especialistaId: primero.id, nombre: primero.nombre, razones };
}

export const NOMBRES_PROCESO: Record<string, string> = {
  intake_rrpp: 'Ingreso RRPP',
  asignacion_especialista: 'Asignación de Especialista',
  preparacion_inicial: 'Preparación inicial',
  edicion: 'Edición',
  correccion: 'Corrección',
  direccion_creativa: 'Dirección Creativa',
  diseno: 'Diseño',
  revision_interna_cubierta: 'Revisión de cubierta',
  calidad: 'Calidad',
  validacion: 'Validación',
  fase_calidad_1: 'Fase de Calidad 1',
  revision_final: 'Revisión final',
  soporte_digital: 'Soporte digital',
  lanzamiento: 'Lanzamiento',
  impresion: 'Impresión',
  distribucion: 'Distribución',
};
const destinos: Record<string, string> = {
  edicion: 'Jefe de Edición',
  correccion: 'Especialista',
  direccion_creativa: 'Jefatura',
  diseno: 'Especialista',
  revision_interna_cubierta: 'Jefe de Edición',
  calidad: 'Soporte editorial',
};

export async function obtenerDashboardJefatura(
  ahora = new Date(),
  opciones: { historico?: boolean; incluirRetirados?: boolean; proyectoId?: string; especialistaId?: string } = {},
): Promise<DashboardJefatura> {
  const estados = opciones.historico ? [...ESTADOS_ACTIVOS, 'culminado' as const, ...(opciones.incluirRetirados ? ['retirado' as const] : [])] : ESTADOS_ACTIVOS;
  const ambito = and(inArray(proyectos.estado, estados), opciones.proyectoId ? eq(proyectos.id, opciones.proyectoId) : undefined, opciones.especialistaId ? eq(especialistaActualSql, opciones.especialistaId) : undefined);
  // Número fijo de lecturas por lotes; nunca una consulta por proyecto/persona.
  const ultimaVersionDiseno = db
    .selectDistinctOn([disenoVersiones.disenoId], {
      disenoId: disenoVersiones.disenoId,
      entregadoEn: disenoVersiones.entregadoEn,
    })
    .from(disenoVersiones)
    .orderBy(disenoVersiones.disenoId, desc(disenoVersiones.numero))
    .as('ultima_version_diseno');
  const [filas, personas, trabajos, asignaciones, pausasActivas, creativas] =
    await Promise.all([
      db
        .select({
          p: proyectos,
          s: servicios,
          autor: autores.nombre,
          deseadaFicha: fichasTrazabilidad.fechaDeseadaCulminacion,
          subtipo: fichasTrazabilidad.ingresoServicioSubtipoCrudo,
          ingreso: fichasTrazabilidad.ingresoFechaIngreso,
        })
        .from(proyectos)
        .innerJoin(servicios, eq(servicios.id, proyectos.servicioId))
        .innerJoin(autores, eq(autores.id, proyectos.autorId))
        .leftJoin(
          fichasTrazabilidad,
          eq(fichasTrazabilidad.proyectoId, proyectos.id),
        )
        .where(ambito),
      db
        .select({
          id: users.id,
          nombre: users.nombre,
          rol: users.rol,
          activo: users.activo,
        })
        .from(users),
      db
        .select({
          item: workItems,
          decisionId: sql<string | null>`(SELECT d.id FROM decisiones d WHERE d.origin_work_item_id=${workItems.id} AND d.target_role='jefe_area' AND d.status<>'resuelta' ORDER BY d.requested_at,d.id LIMIT 1)`,
          correccion: {
            dueAt: correcciones.dueAt,
            fechaEntrega: correcciones.fechaEntrega,
            entregadoEn: correcciones.entregadoEn,
            correctorId: correcciones.correctorId,
            correctorNombre: correcciones.correctorNombre,
          },
          diseno: { dueAt: disenos.dueAt },
          entregaDiseno: ultimaVersionDiseno.entregadoEn,
          calidad: {
            dueAt: fichaCalidadFases.dueAt,
            revisadoEn: fichaCalidadFases.revisadoEn,
          },
        })
        .from(workItems)
        .innerJoin(proyectos, eq(proyectos.id, workItems.proyectoId))
        .leftJoin(correcciones, eq(correcciones.workItemId, workItems.id))
        .leftJoin(disenos, eq(disenos.workItemId, workItems.id))
        .leftJoin(
          ultimaVersionDiseno,
          eq(ultimaVersionDiseno.disenoId, disenos.id),
        )
        .leftJoin(
          fichaCalidadFases,
          eq(fichaCalidadFases.workItemId, workItems.id),
        )
        .where(
          and(
            ambito,
            inArray(workItems.estado, [
              'pendiente',
              'en_progreso',
              'bloqueado',
            ]),
          ),
        ),
      db
        .select({ a: projectAssignments })
        .from(projectAssignments)
        .innerJoin(proyectos, eq(proyectos.id, projectAssignments.proyectoId))
        .where(
          and(
            ambito,
            or(isNull(projectAssignments.finalizadoEn), and(eq(projectAssignments.tipo, 'especialista'), isNull(projectAssignments.workItemId))),
          ),
        ),
      db
        .select({ pausa: pausas })
        .from(pausas)
        .innerJoin(proyectos, eq(proyectos.id, pausas.proyectoId))
        .where(ambito),
      db
        .select({
          id: direccionesCreativas.id,
          workItemId: direccionesCreativas.workItemId,
        })
        .from(direccionesCreativas)
        .innerJoin(proyectos, eq(proyectos.id, direccionesCreativas.proyectoId))
        .where(ambito),
    ]);
  const autoresPorProyecto = await obtenerAutoresPorProyectos(
    filas.map((f) => f.p.id),
  );
  const nombres = new Map(personas.map((u) => [u.id, u.nombre]));
  const porProyecto = new Map<string, typeof trabajos>();
  for (const t of trabajos) {
    const lista = porProyecto.get(t.item.proyectoId) ?? [];
    lista.push(t);
    porProyecto.set(t.item.proyectoId, lista);
  }
  const pausasPorProyecto = new Map<string, typeof pausasActivas>();
  for (const t of pausasActivas) {
    const lista = pausasPorProyecto.get(t.pausa.proyectoId) ?? [];
    lista.push(t);
    pausasPorProyecto.set(t.pausa.proyectoId, lista);
  }
  const especialistaActivo = new Map(
    asignaciones
      .filter((t) => t.a.tipo === 'especialista' && !t.a.workItemId && !t.a.finalizadoEn)
      .map((t) => [t.a.proyectoId, t.a.usuarioId]),
  );
  const historialEspecialista = new Set(asignaciones.filter(t => t.a.tipo === 'especialista' && !t.a.workItemId).map(t => t.a.proyectoId));
  const responsables = new Map<string, string[]>();
  for (const { a } of asignaciones)
    if (a.workItemId && !a.finalizadoEn) {
      const lista = responsables.get(a.workItemId) ?? [];
      lista.push(nombres.get(a.usuarioId) ?? 'Responsable asignado');
      responsables.set(a.workItemId, lista);
    }
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  const todos: ProyectoJefatura[] = filas.map(
    ({ p, s, autor, deseadaFicha, subtipo, ingreso }) => {
      const especialistaId = resolverEspecialistaActual(
        especialistaActivo.get(p.id),
        p.especialistaId,
        historialEspecialista.has(p.id),
      );
      const procesos = (porProyecto.get(p.id) ?? [])
        .filter(
          (t) =>
            t.item.tipo !== 'intake_rrpp' &&
            t.item.tipo !== 'asignacion_especialista',
        )
        .map(({ item, decisionId, correccion, diseno, entregaDiseno, calidad }) => {
          const limite = correccion?.dueAt ?? diseno?.dueAt ?? calidad?.dueAt;
          const plazo = correccion?.dueAt
            ? evaluarPlazoCorreccion(
                correccion.dueAt,
                correccion.fechaEntrega,
                ahora,
                correccion.entregadoEn,
              )
            : diseno?.dueAt
              ? plazoDiseno(diseno.dueAt, entregaDiseno, ahora)
              : calidad?.dueAt
                ? plazoDiseno(calidad.dueAt, calidad.revisadoEn, ahora)
                : null;
          return {
            id: item.id,
            decisionId,
            tipo: item.tipo,
            nombre: NOMBRES_PROCESO[item.tipo] ?? 'Proceso editorial',
            estado: decisionId && item.tipo==='correccion' ? 'bloqueado' : item.estado,
            vence: limite?.toISOString() ?? item.fechaFinPautada,
            entregado: !!(correccion?.fechaEntrega || correccion?.entregadoEn || entregaDiseno || calidad?.revisadoEn),
            vencido: limite
              ? plazo === 'vencido'
              : !!item.fechaFinPautada && item.fechaFinPautada < hoy,
            responsable:
              responsables.get(item.id)?.join(', ') ??
              (item.tipo === 'edicion' && p.editorId
                ? (nombres.get(p.editorId) ?? null)
                : (correccion?.correctorNombre ??
                  (correccion?.correctorId
                    ? (nombres.get(correccion.correctorId) ?? null)
                    : null))),
          };
        });
      const dias = calcularDuracionEfectivaDias(
        fecha(p.fechaRealInicio ?? p.fechaProgramadaInicio),
        ahora,
        (pausasPorProyecto.get(p.id) ?? []).map((t) => t.pausa),
        ahora,
      );
      const express = evaluarExpressJefatura(p, s, deseadaFicha, subtipo, ingreso);
      return {
        id: p.id,
        codigo: p.codigo,
        titulo: p.tituloDefinitivo?.trim() || p.titulo?.trim() || null,
        creadoEn: p.createdAt.toISOString(),
        portadaUrl: p.portadaDecisionAutor === 'aprobada' ? p.propuestaPortadaUrl : null,
        fechaObjetivo: p.fechaFinProyectada ?? (express.estado === 'confirmado' ? express.fechaDeseada : express.fechaEstandar),
        entregadoJefatura: p.notificadoJefatura,
        asignacionDesincronizada:
          especialistaActivo.has(p.id) &&
          especialistaActivo.get(p.id) !== p.especialistaId,
        impactoCarga: s.pesoComplejidad,
        autores:
          autoresPorProyecto
            .get(p.id)
            ?.map((a) => a.nombre)
            .join(', ') || autor,
        estado: p.estado,
        subtipoCrudo: s.codigo === 'CR' ? subtipo : null,
        datoIncompleto: s.codigo === 'CR' && !resolverPlazosServicio(s, subtipo),
        servicio: {
          id: s.id,
          codigo: s.codigo,
          nombre: nombreServicioProyecto(s.codigo, s.nombre, subtipo),
          nombreCatalogo: s.nombre,
          peso: s.pesoComplejidad,
        },
        especialista: especialistaId
          ? {
              id: especialistaId,
              nombre: nombres.get(especialistaId) ?? 'Especialista asignado',
            }
          : null,
        porAsignar: ESTADOS_ACTIVOS.includes(p.estado) && p.notificadoJefatura && !especialistaId,
        express,
        riesgo: !ESTADOS_ACTIVOS.includes(p.estado) ? { atencion: false, causas: [], vencido: false, diasRestantes: 0, diasEfectivos: dias } : evaluarAtencionJefatura(
          evaluarRiesgo(dias, determinarDiasPlazoAlerta(resolverPlazosServicio(s, subtipo) ?? s)),
          p.estado,
          procesos,
        ),
        procesos,
        recomendacion: null,
      };
    },
  );
  const teamCapacity = ordenarCandidatos(
    personas
      .filter((u) => u.rol === 'especialista' && u.activo && (!opciones.especialistaId || u.id === opciones.especialistaId))
      .map((u) => {
        const propios = todos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado as typeof ESTADOS_ACTIVOS[number]) && p.especialista?.id === u.id);
        const composicion = new Map<
          string,
          CapacidadJefatura['servicios'][number]
        >();
        for (const p of propios) {
          const dato = composicion.get(p.servicio.codigo) ?? {
            codigo: p.servicio.codigo,
            nombre: p.servicio.nombreCatalogo ?? p.servicio.nombre,
            cantidad: 0,
            carga: 0,
          };
          dato.cantidad++;
          dato.carga += p.servicio.peso;
          composicion.set(dato.codigo, dato);
        }
        return {
          id: u.id,
          nombre: u.nombre,
          carga: calcularCarga(propios.map((p) => p.servicio.peso)),
          activos: propios.length,
          express: propios.filter((p) => p.express.estado === 'confirmado')
            .length,
          enRiesgo: propios.filter((p) => p.riesgo.atencion).length,
          servicios: [...composicion.values()],
        };
      }),
  );
  const recomendacion = recomendarEspecialista(teamCapacity);
  const idsAmbito = new Set(
    filas
      .filter(
        (f) =>
          f.p.notificadoJefatura ||
          f.p.especialistaId ||
          especialistaActivo.has(f.p.id),
      )
      .map((f) => f.p.id),
  );
  const listado = todos
    .filter((p) => idsAmbito.has(p.id))
    .map((p) => ({ ...p, recomendacion: p.porAsignar ? recomendacion : null }));
  listado.sort(
    (a, b) =>
      Number(b.express.estado === 'confirmado') -
        Number(a.express.estado === 'confirmado') ||
      b.express.compresionDias - a.express.compresionDias ||
      a.riesgo.diasRestantes - b.riesgo.diasRestantes ||
      a.codigo.localeCompare(b.codigo),
  );
  const lookup = new Map(listado.map((p) => [p.id, p]));
  const creativaPorItem = new Map(creativas.map((c) => [c.workItemId, c.id]));
  const requests: SolicitudJefatura[] = trabajos
    .filter(
      ({ item }) =>
        item.estado === 'pendiente' &&
        destinos[item.tipo] &&
        lookup.has(item.proyectoId),
    )
    .flatMap(({ item }) => {
      const p = lookup.get(item.proyectoId)!;
      // Pendiente no siempre es una solicitud de asignación: exigir intervención real.
      if (
        item.tipo === 'direccion_creativa' &&
        (!creativaPorItem.has(item.id) || responsables.has(item.id))
      )
        return [];
      if (
        item.tipo === 'edicion' &&
        filas.find((f) => f.p.id === item.proyectoId)?.p.editorId
      )
        return [];
      return [
        {
          id: item.id,
          proyectoId: p.id,
          codigo: p.codigo,
          autores: p.autores,
          titulo:
            item.tipo === 'direccion_creativa'
              ? 'Asignar Líder Creativo'
              : `Revisar solicitud de ${NOMBRES_PROCESO[item.tipo] ?? 'proceso'}`,
          destino: destinos[item.tipo]!,
          requiereJefatura: item.tipo === 'direccion_creativa',
          creadaEn: item.createdAt.toISOString(),
          direccionCreativaId:
            item.tipo === 'direccion_creativa'
              ? creativaPorItem.get(item.id)!
              : null,
        },
      ];
    })
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
  const resumenDec = opciones.especialistaId ? { pendientes: 0 } : await resumenDecisiones();
  return {
    actualizadoEn: ahora.toISOString(),
    summary: {
      porAsignar: listado.filter((p) => p.porAsignar).length,
      solicitudes: requests.filter((r) => r.requiereJefatura).length,
      enRiesgo: listado.filter((p) => p.riesgo.atencion).length,
      express: listado.filter(
        (p) =>
          p.express.estado === 'posible' || p.express.estado === 'confirmado',
      ).length,
      decisiones: resumenDec.pendientes,
    },
    proyectos: listado,
    teamCapacity,
    requests,
    priorityTracking: listado
      .filter((p) => p.riesgo.atencion && p.especialista)
      .slice(0, 6),
  };
}

export async function decidirExpressJefatura(
  proyectoId: string,
  actorId: string,
  input: {
    decision: 'confirmado' | 'normal';
    fechaEstandar: string;
    fechaDeseada: string;
    motivo?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, proyectoId))
      .for('update');
    if (!p)
      return {
        ok: false as const,
        status: 404,
        error: 'Proyecto no encontrado',
      };
    if (!p.notificadoJefatura || !ESTADOS_ACTIVOS.includes(p.estado))
      return {
        ok: false as const,
        status: 409,
        error: 'El proyecto debe estar activo y enviado formalmente por RRPP',
      };
    const [s] = await tx
      .select()
      .from(servicios)
      .where(eq(servicios.id, p.servicioId));
    const [f] = await tx
      .select({ deseada: fichasTrazabilidad.fechaDeseadaCulminacion, subtipo: fichasTrazabilidad.ingresoServicioSubtipoCrudo, ingreso: fichasTrazabilidad.ingresoFechaIngreso })
      .from(fichasTrazabilidad)
      .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
      .for('update');
    if (!s) throw new Error('Servicio del proyecto no encontrado');
    const express = evaluarExpressJefatura(p, s, f?.deseada ?? null, f?.subtipo ?? null, f?.ingreso ?? null);
    if (
      !express.compresionDias ||
      express.fechaEstandar !== input.fechaEstandar ||
      express.fechaDeseada !== input.fechaDeseada
    )
      return {
        ok: false as const,
        status: 409,
        error:
          'Las fechas cambiaron o el proyecto no es candidato Express. Actualiza la vista.',
      };
    if (
      p.expressDecision === input.decision &&
      p.expressFechaEstandar === express.fechaEstandar &&
      p.expressFechaDeseada === express.fechaDeseada
    )
      return { ok: true as const, cambio: false };
    await tx
      .update(proyectos)
      .set({
        expressDecision: input.decision,
        expressFechaEstandar: express.fechaEstandar,
        expressFechaDeseada: express.fechaDeseada,
        expressDecididoPorId: actorId,
        expressDecididoEn: new Date(),
        expressMotivo: input.motivo?.trim() || null,
      })
      .where(eq(proyectos.id, proyectoId));
    await registrarEvento(tx, {
      actorId,
      accion:
        input.decision === 'confirmado'
          ? 'EXPRESS_CONFIRMADO'
          : 'PRIORIDAD_NORMAL_CONFIRMADA',
      entityType: 'proyecto',
      entityId: proyectoId,
      proyectoId,
      detalles: {
        anterior: express.estado,
        nuevo: input.decision,
        fechaEstandar: express.fechaEstandar,
        fechaDeseada: express.fechaDeseada,
        compresionDias: express.compresionDias,
        motivo: input.motivo?.trim() || null,
      },
    });
    return { ok: true as const, cambio: true };
  });
}

const textosActividad: Record<string, string> = {
  JEFATURA_NOTIFICADA: 'envió el proyecto a Jefatura',
  ESPECIALISTA_ASIGNADO: 'asignó Especialista',
  ESPECIALISTA_REASIGNADO: 'reasignó Especialista',
  EDITOR_SOLICITADO: 'solicitó Editor',
  CORRECCION_SOLICITADA: 'solicitó Corrección',
  DIRECCION_CREATIVA_SOLICITADA: 'solicitó Dirección Creativa',
  LIDER_CREATIVO_ASIGNADO: 'asignó Líder Creativo',
  INFORMACION_COMERCIAL_ACTUALIZADA: 'actualizó la información comercial',
  EXPRESS_CONFIRMADO: 'confirmó prioridad Express',
  PRIORIDAD_NORMAL_CONFIRMADA: 'mantuvo prioridad normal',
};
export async function obtenerActividadJefatura(): Promise<ActividadJefatura[]> {
  const filas = await db
    .select({
      id: auditLogs.id,
      proyectoId: proyectos.id,
      codigo: proyectos.codigo,
      actor: users.nombre,
      accion: auditLogs.accion,
      fecha: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(proyectos, eq(proyectos.id, auditLogs.proyectoId))
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(
      and(
        eq(proyectos.notificadoJefatura, true),
        inArray(auditLogs.accion, Object.keys(textosActividad)),
      ),
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(5);
  return filas.map((f) => ({
    id: f.id,
    proyectoId: f.proyectoId,
    codigo: f.codigo,
    actor: f.actor ?? 'Equipo PanHouse',
    texto: textosActividad[f.accion]!,
    fecha: f.fecha.toISOString(),
  }));
}
