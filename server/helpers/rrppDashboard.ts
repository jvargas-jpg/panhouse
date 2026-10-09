import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  auditLogs,
  autores,
  fichaLanzamientoReuniones,
  fichasTrazabilidad,
  proyectos,
  servicios,
  workItems,
  rrppEventos,
} from '../db/schema/index.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { listarPropuestasPendientesRrpp } from './direccionCreativa.js';
import { diagnosticoListo, tieneTrabajoRrpp } from './intakeRrpp.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';
import { obtenerAutoresPorProyectos } from './proyectosAutores.js';
import { EVENTOS_LANZAMIENTO_RRPP } from './rrppLanzamientoCatalogos.js';

export interface ProyectoRrpp {
  id: string;
  codigo: string;
  nombre: string;
  autores: { nombre: string }[];
  servicio: { codigo: string; nombre: string };
  subtipoCrudo: string | null;
}
export interface IngresoRrpp extends ProyectoRrpp {
  estado: 'nuevo' | 'diagnostico' | 'completo';
  pendiente: string;
  enviadoJefatura: boolean;
  actualizadoAt: string | null;
  actualizadoPor: string;
  compartidos: {
    observaciones: string | null;
    capitulos: string | null;
    paginas: string | null;
    fechaIngreso: string | null;
  };
}
const ACTIVIDAD = {
  ...EVENTOS_LANZAMIENTO_RRPP,
  RRPP_NOTIFICADO: 'Nuevo proyecto recibido',
  INFORMACION_COMERCIAL_ACTUALIZADA: 'Comercial actualizó información',
  INTAKE_RRPP_INICIADO: 'Diagnóstico iniciado',
  DIAGNOSTICO_ACTUALIZADO: 'Diagnóstico actualizado',
  DIAGNOSTICO_COMPLETADO: 'Diagnóstico completado',
  JEFATURA_NOTIFICADA: 'Proyecto enviado a Jefatura',
  CONCEPTOS_ENTREGADOS: 'Conceptos de portada enviados',
  CONCEPTO_APROBADO_RRPP: 'Concepto de portada aprobado',
  CONCEPTO_DEVUELTO_RRPP: 'Concepto devuelto con observaciones',
} as const;
const ES_CREATIVA = [
  'CONCEPTOS_ENTREGADOS',
  'CONCEPTO_APROBADO_RRPP',
  'CONCEPTO_DEVUELTO_RRPP',
];

export async function obtenerDashboardRrpp(ahora = new Date()) {
  // Consultas en lote sobre fuentes canónicas. La ficha completa nunca sale en el DTO.
  const [filas, propuestas, reuniones, eventos] = await Promise.all([
    db
      .select({
        proyecto: proyectos,
        ficha: fichasTrazabilidad,
        autorNombre: autores.nombre,
        servicio: { codigo: servicios.codigo, nombre: servicios.nombre },
        item: workItems,
      })
      .from(proyectos)
      .innerJoin(
        fichasTrazabilidad,
        eq(fichasTrazabilidad.proyectoId, proyectos.id),
      )
      .innerJoin(autores, eq(autores.id, proyectos.autorId))
      .innerJoin(servicios, eq(servicios.id, proyectos.servicioId))
      .leftJoin(
        workItems,
        and(
          eq(workItems.proyectoId, proyectos.id),
          eq(workItems.tipo, 'intake_rrpp'),
          eq(workItems.businessKey, 'default'),
        ),
      )
      .where(inArray(proyectos.estado, ESTADOS_ACTIVOS)),
    listarPropuestasPendientesRrpp(),
    db
      .select({
        id: fichaLanzamientoReuniones.id,
        proyectoId: fichasTrazabilidad.proyectoId,
        fecha: fichaLanzamientoReuniones.fecha,
      })
      .from(fichaLanzamientoReuniones)
      .innerJoin(
        fichasTrazabilidad,
        eq(fichasTrazabilidad.id, fichaLanzamientoReuniones.fichaId),
      )
      .innerJoin(proyectos, eq(proyectos.id, fichasTrazabilidad.proyectoId))
      .where(
        and(
          eq(proyectos.notificadoRrpp, true),
          inArray(proyectos.estado, ESTADOS_ACTIVOS),
        ),
      ),
    db
      .select({
        id: auditLogs.id,
        proyectoId: auditLogs.proyectoId,
        accion: auditLogs.accion,
        fecha: auditLogs.createdAt,
      })
      .from(auditLogs)
      .innerJoin(proyectos, eq(proyectos.id, auditLogs.proyectoId))
      .where(
        and(
          inArray(proyectos.estado, ESTADOS_ACTIVOS),
          inArray(auditLogs.accion, Object.keys(ACTIVIDAD)),
        ),
      )
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)),
  ]);
  const autoresPorProyecto = await obtenerAutoresPorProyectos(
    filas.map((f) => f.proyecto.id),
  );
  const bases = new Map(
    filas.map((f) => {
      const nombres = (
        autoresPorProyecto.get(f.proyecto.id) ?? [{ nombre: f.autorNombre }]
      ).map((a) => ({ nombre: a.nombre }));
      const base: ProyectoRrpp = {
        id: f.proyecto.id,
        codigo: f.proyecto.codigo,
        nombre: nombres.map((a) => a.nombre).join(', '),
        autores: nombres,
        servicio: f.servicio,
        subtipoCrudo: f.ficha.ingresoServicioSubtipoCrudo,
      };
      return [f.proyecto.id, { ...f, base }] as const;
    }),
  );
  const visibles = eventos.filter(
    (e) =>
      e.proyectoId &&
      bases.has(e.proyectoId) &&
      (bases.get(e.proyectoId)?.proyecto.notificadoRrpp ||
        ES_CREATIVA.includes(e.accion)),
  );
  const ingresos: IngresoRrpp[] = [];
  for (const f of bases.values()) {
    if (!f.proyecto.notificadoRrpp || f.item?.estado === 'cancelado') continue;
    const completado =
      f.proyecto.notificadoJefatura ||
      f.item?.estado === 'completado' ||
      diagnosticoListo(f.ficha, f.servicio.codigo);
    // Campos propios de RRPP son evidencia de trabajo guardado también en registros legacy.
    const iniciado =
      (!!f.item && f.item.estado !== 'pendiente') || tieneTrabajoRrpp(f.ficha);
    const estado = completado ? 'completo' : iniciado ? 'diagnostico' : 'nuevo';
    const evento = visibles.find(
      (e) => e.proyectoId === f.proyecto.id && !ES_CREATIVA.includes(e.accion),
    );
    ingresos.push({
      ...f.base,
      estado,
      enviadoJefatura: f.proyecto.notificadoJefatura,
      pendiente: completado
        ? f.proyecto.notificadoJefatura
          ? 'Enviado a Jefatura'
          : 'Listo para Jefatura'
        : f.servicio.codigo === 'CR' && !f.ficha.ingresoServicioSubtipoCrudo
          ? 'CRUDO · pendiente de clasificación'
          : estado === 'nuevo'
            ? 'Pendiente de diagnóstico'
            : evaluarPreparacionRrpp(f.ficha, f.servicio.codigo).faltantes[0]?.etiqueta ?? 'Completar diagnóstico',
      actualizadoAt: evento?.fecha.toISOString() ?? null,
      actualizadoPor: evento
        ? evento.accion === 'RRPP_NOTIFICADO'
          ? 'Enviado por Comercial'
          : ACTIVIDAD[evento.accion as keyof typeof ACTIVIDAD]
        : 'Fecha de actividad no registrada',
      compartidos: {
        observaciones: f.ficha.ingresoObservaciones,
        capitulos: f.ficha.capitulosPactados,
        paginas: f.ficha.paginasPactadas,
        fechaIngreso: f.ficha.ingresoFechaIngreso,
      },
    });
  }
  ingresos.sort(
    (a, b) =>
      ({ nuevo: 0, diagnostico: 1, completo: 2 })[a.estado] -
        { nuevo: 0, diagnostico: 1, completo: 2 }[b.estado] ||
      (b.actualizadoAt ?? '').localeCompare(a.actualizadoAt ?? ''),
  );
  const conceptos = new Map<
    string,
    {
      proyecto: ProyectoRrpp;
      direccionId: string;
      actualizadoAt: string;
      propuestas: {
        id: string;
        descripcion: string | null;
        enlace: string | null;
      }[];
    }
  >();
  for (const p of propuestas) {
    const f = bases.get(p.proyectoId);
    if (
      !f ||
      p.tipo !== 'concepto_portada' ||
      p.fechaCierre ||
      ['completado', 'cancelado'].includes(p.workItemEstado) ||
      p.estado === 'Devuelta por RRPP'
    )
      continue;
    let grupo = conceptos.get(p.direccionCreativaId);
    if (!grupo) {
      grupo = {
        proyecto: f.base,
        direccionId: p.direccionCreativaId,
        actualizadoAt: p.createdAt.toISOString(),
        propuestas: [],
      };
      conceptos.set(p.direccionCreativaId, grupo);
    }
    if (p.createdAt.toISOString() > grupo.actualizadoAt)
      grupo.actualizadoAt = p.createdAt.toISOString();
    grupo.propuestas.push({
      id: p.propuestaId,
      descripcion: p.descripcion,
      enlace: p.enlace,
    });
  }
  const desde = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  const hasta = new Date(
    new Date(desde + 'T12:00:00Z').getTime() + 30 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const lanzamientos: {
    id: string;
    proyecto: ProyectoRrpp;
    fecha: string;
    tipo: string;
    href: string;
  }[] = [];
  function agregar(
    id: string,
    proyectoId: string,
    fecha: string | null,
    tipo: string,
    _reuniones = false,
  ) {
    const base = bases.get(proyectoId);
    if (
      base?.proyecto.notificadoRrpp &&
      fecha &&
      fecha >= desde &&
      fecha <= hasta
    )
      lanzamientos.push({
        id,
        proyecto: base.base,
        fecha,
        tipo,
        href: `/rrpp/lanzamientos?proyecto=${proyectoId}`,
      });
  }
  for (const f of bases.values()) {
    agregar(
      f.proyecto.id + '-primera',
      f.proyecto.id,
      f.ficha.lanzamientoPromocionFechaPrimeraReunion,
      'Primera reunión de lanzamiento',
    );
    agregar(
      f.proyecto.id + '-segunda',
      f.proyecto.id,
      f.ficha.lanzamientoPromocionFechaSegundaReunion,
      'Segunda reunión de lanzamiento',
    );
    agregar(
      f.proyecto.id + '-lanzamiento',
      f.proyecto.id,
      f.ficha.lanzamientoPromocionFechaTentativa,
      f.ficha.lanzamientoPromocionTipo || 'Lanzamiento tentativo',
    );
  }
  for (const r of reuniones)
    agregar(r.id, r.proyectoId, r.fecha, 'Reunión de lanzamiento', true);
  const agenda = await db.select().from(rrppEventos).where(sql`${rrppEventos.fecha} between ${desde} and ${hasta}`);
  for (const e of agenda) {
    if (e.estado === 'Completada') continue;
    agregar(e.id, e.proyectoId, e.fecha, e.tipo);
    const fila = lanzamientos.find(l => l.id === e.id);
    if (fila) fila.href = `/rrpp/lanzamientos?tab=agenda&proyecto=${e.proyectoId}&mes=${e.fecha.slice(0,7)}&dia=${e.fecha}`;
  }
  lanzamientos.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
  );
  return {
    kpis: {
      nuevos: ingresos.filter((i) => i.estado === 'nuevo').length,
      enProceso: ingresos.filter((i) => i.estado === 'diagnostico').length,
      conceptos: [...conceptos.values()].reduce(
        (n, c) => n + c.propuestas.length,
        0,
      ),
      lanzamientos: lanzamientos.length,
    },
    ingresos,
    conceptos: [...conceptos.values()],
    lanzamientos,
    periodoLanzamientos: { desde, hasta },
    actividad: visibles
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        proyecto: bases.get(e.proyectoId!)!.base,
        titulo: ACTIVIDAD[e.accion as keyof typeof ACTIVIDAD],
        fecha: e.fecha.toISOString(),
        contexto: ES_CREATIVA.includes(e.accion)
          ? ('conceptos' as const)
          : ('ingreso' as const),
      })),
  };
}
