import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  fichasTrazabilidad,
  pasos,
  fases,
  projectAssignments,
  proyectos,
  servicios,
  unidades,
  presupuestos,
  users,
  workItems,
  correcciones,
} from '../db/schema/index.js';
import { NOMBRES_PROCESO, obtenerDashboardJefatura } from './jefatura.js';
import { historialFicha } from './fichaViva.js';
import { evaluarPreparacionComercial } from './preparacionComercial.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';
import {
  estadoPortafolio,
  perteneceTab,
  ETIQUETAS_TAB,
} from '../../shared/portafolioJefatura.js';
import type {
  FiltrosProyectosJefatura,
  PortafolioJefatura,
  QuickViewJefatura,
  TabProyectosJefatura,
} from '../../shared/jefatura.js';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
// Siete lecturas del snapshot central y una del catálogo, sin consultas por fila.
export async function obtenerPortafolioJefatura(
  f: FiltrosProyectosJefatura,
): Promise<PortafolioJefatura> {
  const [snapshot, catalogo] = await Promise.all([
    obtenerDashboardJefatura(new Date(), { historico: true }),
    db
      .select({ id: servicios.id, nombre: servicios.nombre })
      .from(servicios)
      .orderBy(servicios.nombre),
  ]);
  const q = normalizar(f.q);
  const counts = Object.fromEntries(
    Object.keys(ETIQUETAS_TAB).map((t) => [
      t,
      snapshot.proyectos.filter((p) =>
        perteneceTab(p, t as TabProyectosJefatura),
      ).length,
    ]),
  ) as PortafolioJefatura['counts'];
  const filtrados = snapshot.proyectos.filter(
    (p) =>
      (!f.servicioId || p.servicio.id === f.servicioId) &&
      (!f.especialistaId ||
        (f.especialistaId === 'sinAsignar'
          ? !p.especialista
          : p.especialista?.id === f.especialistaId)) &&
      (!f.estado || estadoPortafolio(p) === f.estado) &&
      (!q ||
        normalizar(`${p.codigo} ${p.titulo ?? ''} ${p.autores}`).includes(q)),
  );
  const tabCounts = Object.fromEntries(
    Object.keys(ETIQUETAS_TAB).map((t) => [
      t,
      filtrados.filter((p) => perteneceTab(p, t as TabProyectosJefatura))
        .length,
    ]),
  ) as PortafolioJefatura['counts'];
  const items = filtrados.filter((p) => perteneceTab(p, f.tab));
  items.sort((a, b) => {
    let order = 0;
    if (f.orden === 'recientes') order = b.creadoEn.localeCompare(a.creadoEn);
    else if (f.orden === 'autor')
      order = a.autores.localeCompare(b.autores, 'es');
    else if (f.orden === 'fecha')
      order = (a.fechaObjetivo ?? '9999').localeCompare(
        b.fechaObjetivo ?? '9999',
      );
    else
      order =
        Number(b.riesgo.vencido) - Number(a.riesgo.vencido) ||
        Number(b.riesgo.atencion) - Number(a.riesgo.atencion) ||
        Number(b.express.estado === 'confirmado') -
          Number(a.express.estado === 'confirmado') ||
        a.riesgo.diasRestantes - b.riesgo.diasRestantes;
    return (
      order || a.codigo.localeCompare(b.codigo) || a.id.localeCompare(b.id)
    );
  });
  const pages = Math.max(1, Math.ceil(items.length / f.pageSize));
  const page = Math.min(f.page, pages);
  return {
    items: items.slice((page - 1) * f.pageSize, page * f.pageSize),
    counts,
    tabCounts,
    filters: {
      servicios: catalogo,
      especialistas: snapshot.teamCapacity.map(({ id, nombre }) => ({
        id,
        nombre,
      })),
    },
    pagination: { page, pageSize: f.pageSize, pages, total: items.length },
  };
}

export async function obtenerQuickViewJefatura(
  id: string,
): Promise<QuickViewJefatura | null> {
  // La comprobación de ámbito sucede antes de leer o devolver información privada.
  const snapshot = await obtenerDashboardJefatura(new Date(), {
    historico: true,
  });
  const proyecto = snapshot.proyectos.find((p) => p.id === id);
  if (!proyecto) return null;
  const [datos, assignments, trabajos, correctores] = await Promise.all([
    db
      .select({
        p: proyectos,
        f: fichasTrazabilidad,
        unidad: unidades.nombre,
        presupuesto: presupuestos.nombre,
      })
      .from(proyectos)
      .leftJoin(
        fichasTrazabilidad,
        eq(fichasTrazabilidad.proyectoId, proyectos.id),
      )
      .leftJoin(unidades, eq(unidades.id, proyectos.unidadId))
      .leftJoin(presupuestos, eq(presupuestos.id, proyectos.presupuestoId))
      .where(eq(proyectos.id, id))
      .limit(1),
    db
      .select({
        a: projectAssignments,
        nombre: users.nombre,
        proceso: workItems.tipo,
      })
      .from(projectAssignments)
      .innerJoin(users, eq(users.id, projectAssignments.usuarioId))
      .leftJoin(workItems, eq(workItems.id, projectAssignments.workItemId))
      .where(
        and(
          eq(projectAssignments.proyectoId, id),
          isNull(projectAssignments.finalizadoEn),
        ),
      ),
    db
      .select({ item: workItems, paso: pasos.nombre, fase: fases.nombre })
      .from(workItems)
      .leftJoin(pasos, eq(pasos.id, workItems.pasoId))
      .leftJoin(fases, eq(fases.id, pasos.faseId))
      .where(eq(workItems.proyectoId, id))
      .orderBy(workItems.createdAt, workItems.id),
    db
      .select({
        id: correcciones.id,
        nombre: correcciones.correctorNombre,
        usuarioId: correcciones.correctorId,
        usuario: users.nombre,
      })
      .from(correcciones)
      .leftJoin(users, eq(users.id, correcciones.correctorId))
      .innerJoin(workItems, eq(workItems.id, correcciones.workItemId))
      .where(
        and(
          eq(correcciones.proyectoId, id),
          inArray(workItems.estado, ['pendiente', 'en_progreso', 'bloqueado']),
        ),
      ),
  ]);
  const d = datos[0];
  if (!d) return null;
  const f = d.f;
  const comercial =
    !!f &&
    evaluarPreparacionComercial({
      ...d.p,
      ...f,
      autores: [{ id: d.p.autorId }],
    }).listoParaRrpp;
  const rrpp =
    !!f &&
    evaluarPreparacionRrpp(f, proyecto.servicio.codigo).listoParaJefatura;
  const equipo: QuickViewJefatura['equipo'] = assignments.map(
    ({ a, nombre, proceso }) => ({
      id: a.id,
      nombre,
      rol: a.tipo,
      proceso: proceso
        ? (NOMBRES_PROCESO[proceso] ?? 'Proceso editorial')
        : null,
      asignadoEn: a.asignadoEn.toISOString(),
    }),
  );
  // Compatibilidad con responsables anteriores al historial formal; nunca con históricos finalizados.
  const fallback = [
    ['especialista', proyecto.especialista?.id],
    ['editor', d.p.editorId],
    ['corrector', d.p.correctorId],
    ['disenador', d.p.disenadorId],
    ['jefe_area', d.p.jefeAreaId],
  ] as const;
  const idsFallback = fallback
    .map(([, userId]) => userId)
    .filter((id): id is string => !!id);
  const personas = idsFallback.length
    ? await db
        .select({ id: users.id, nombre: users.nombre })
        .from(users)
        .where(inArray(users.id, idsFallback))
    : [];
  for (const [rol, userId] of fallback) {
    if (userId && !assignments.some(({ a }) => a.tipo === rol && !a.workItemId))
      equipo.push({
        id: `fk-${rol}-${userId}`,
        nombre:
          personas.find((u) => u.id === userId)?.nombre ??
          'Responsable asignado',
        rol,
        proceso: null,
        asignadoEn: null,
      });
  }
  for (const c of correctores)
    if (
      (c.usuario ?? c.nombre) &&
      !equipo.some(
        (a) => a.rol === 'corrector' && a.nombre === (c.usuario ?? c.nombre),
      )
    ) {
      equipo.push({
        id: c.id,
        nombre: (c.usuario ?? c.nombre)!,
        rol: 'corrector',
        proceso: 'Corrección',
        asignadoEn: null,
      });
    }
  return {
    proyecto,
    contexto: {
      ingreso: f?.ingresoFechaIngreso ?? null,
      cierreProyectado: proyecto.fechaObjetivo ?? null,
      ejecucion: f?.ingresoServicioEjecucion ?? null,
      tiempoExpressMeses: f?.ingresoTiempoExpresMeses ?? null,
      subtipoCrudo: proyecto.subtipoCrudo,
      capitulos: f?.capitulosPactados ?? null,
      paginas: f?.paginasPactadas ?? null,
      presupuesto: f?.ingresoServicioPresupuesto ?? d.presupuesto,
      alianza: f?.ingresoServicioAlianza ?? null,
      unidad: d.unidad,
      comercial: comercial ? 'Completo' : 'Dato incompleto',
      rrpp: d.p.notificadoJefatura && rrpp ? 'Completo' : 'Dato incompleto',
    },
    resumenRrpp: f?.ingresoObservaciones ?? null,
    equipo,
    hitos: trabajos.map(({ item, paso, fase }) => ({
      id: item.id,
      nombre: paso ?? NOMBRES_PROCESO[item.tipo] ?? 'Proceso editorial',
      fase,
      estado: item.estado,
      fecha:
        item.fechaFinReal ??
        item.fechaFinPautada ??
        item.fechaInicioReal ??
        item.fechaInicioPautada,
      gate: item.gateBloqueante,
    })),
  };
}

export async function obtenerActividadProyectoJefatura(id: string) {
  const snapshot = await obtenerDashboardJefatura(new Date(), {
    historico: true,
  });
  if (!snapshot.proyectos.some((p) => p.id === id)) return null;
  const p = snapshot.proyectos.find((p) => p.id === id)!;
  const history = await historialFicha(id, undefined, 30);
  return history.items.map((a) => ({
    id: a.id,
    proyectoId: id,
    codigo: p.codigo,
    actor: a.actor,
    texto: a.label,
    fecha: a.date,
  }));
}
