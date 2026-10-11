import type {
  AsignacionesJefatura,
  ComparacionAsignacion,
  FiltrosAsignaciones,
  ProyectoJefatura,
} from '../../shared/jefatura.js';
import {
  obtenerDashboardJefatura,
  ordenarCandidatos,
  recomendarEspecialista,
} from './jefatura.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { proyectos, fichasTrazabilidad, unidades, presupuestos } from '../db/schema/index.js';
import { evaluarPreparacionComercial } from './preparacionComercial.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';

const normalizar = (v: string) =>
  v.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
const express = (p: ProyectoJefatura) =>
  p.express.estado === 'posible' || p.express.estado === 'confirmado';
function conRecomendacion(
  p: ProyectoJefatura,
  equipo: Awaited<ReturnType<typeof obtenerDashboardJefatura>>['teamCapacity'],
) {
  // Reasignar compara alternativas autorizadas. La persona actual se conserva
  // en el ranking y su carga proyectada no suma el proyecto por segunda vez.
  const recomendacion = recomendarEspecialista(
    equipo.filter((c) => c.id !== p.especialista?.id),
  );
  if (p.especialista && recomendacion) {
    recomendacion.razones[0] = recomendacion.razones[0]!.replace(
      'mínima del equipo',
      'mínima entre alternativas',
    );
  }
  return {
    ...p,
    recomendacion,
  };
}

export async function obtenerAsignacionesJefatura(
  f: FiltrosAsignaciones,
): Promise<AsignacionesJefatura> {
  const snapshot = await obtenerDashboardJefatura();
  const q = normalizar(f.q);
  const filtrados = snapshot.proyectos.filter(
    (p) =>
      (!f.servicioId || p.servicio.id === f.servicioId) &&
      (!f.especialistaId || p.especialista?.id === f.especialistaId) &&
      (!q ||
        normalizar(`${p.codigo} ${p.autores} ${p.titulo ?? ''}`).includes(q)),
  );
  const grupos = {
    porAsignar: filtrados.filter((p) => p.porAsignar),
    asignados: filtrados.filter((p) => !!p.especialista),
    express: filtrados.filter(express),
    enRiesgo: filtrados.filter((p) => p.riesgo.atencion),
  };
  const proyectos = grupos[f.tab];
  proyectos.sort((a, b) => {
    let orden = 0;
    if (f.orden === 'recientes') orden = b.creadoEn.localeCompare(a.creadoEn);
    else if (f.orden === 'mayorImpacto')
      orden = b.impactoCarga - a.impactoCarga;
    else if (f.orden === 'menorImpacto')
      orden = a.impactoCarga - b.impactoCarga;
    else
      orden =
        Number(b.riesgo.vencido) - Number(a.riesgo.vencido) ||
        Number(b.express.estado === 'confirmado') -
          Number(a.express.estado === 'confirmado') ||
        b.express.compresionDias - a.express.compresionDias ||
        a.riesgo.diasRestantes - b.riesgo.diasRestantes;
    return (
      orden || a.codigo.localeCompare(b.codigo) || a.id.localeCompare(b.id)
    );
  });
  const pages = Math.max(1, Math.ceil(proyectos.length / f.pageSize));
  const page = Math.min(f.page, pages);
  const referenciaBarra = Math.max(
    0,
    ...snapshot.teamCapacity.map((c) => c.carga),
  );
  const especialistas = new Map(
    snapshot.teamCapacity.map((c) => [c.id, { id: c.id, nombre: c.nombre }]),
  );
  const servicios = new Map<string, { id: string; nombre: string }>();
  for (const p of snapshot.proyectos) {
    servicios.set(p.servicio.id, {
      id: p.servicio.id,
      nombre: p.servicio.nombre,
    });
    if (p.especialista) especialistas.set(p.especialista.id, p.especialista);
  }
  return {
    actualizadoEn: snapshot.actualizadoEn,
    proyectos: proyectos
      .slice((page - 1) * f.pageSize, page * f.pageSize)
      .map((p) => conRecomendacion(p, snapshot.teamCapacity)),
    contadores: {
      porAsignar: grupos.porAsignar.length,
      asignados: grupos.asignados.length,
      express: grupos.express.length,
      enRiesgo: grupos.enRiesgo.length,
    },
    equipo: [...snapshot.teamCapacity]
      .sort(
        (a, b) =>
          b.carga - a.carga ||
          a.nombre.localeCompare(b.nombre, 'es') ||
          a.id.localeCompare(b.id),
      )
      .map((c) => ({
        ...c,
        barraRelativa: referenciaBarra ? (c.carga / referenciaBarra) * 100 : 0,
      })),
    servicios: [...servicios.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    ),
    especialistas: [...especialistas.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    ),
    referenciaBarra,
    total: proyectos.length,
    page,
    pageSize: f.pageSize,
    pages,
  };
}

export async function compararAsignacionJefatura(
  id: string,
): Promise<ComparacionAsignacion | null> {
  const snapshot = await obtenerDashboardJefatura();
  const original = snapshot.proyectos.find((p) => p.id === id);
  if (!original) return null;
  const proyecto = conRecomendacion(original, snapshot.teamCapacity);
  const [datos] = await db.select({ p: proyectos, f: fichasTrazabilidad, unidad: unidades.nombre, presupuesto: presupuestos.nombre })
    .from(proyectos).leftJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id))
    .leftJoin(unidades, eq(unidades.id, proyectos.unidadId))
    .leftJoin(presupuestos, eq(presupuestos.id, proyectos.presupuestoId))
    .where(eq(proyectos.id, id)).limit(1);
  if (!datos) return null;
  const f = datos.f;
  const comercial = f && evaluarPreparacionComercial({ ...datos.p, ...f, autores: [{ id: datos.p.autorId }] }).listoParaRrpp;
  const rrpp = f && evaluarPreparacionRrpp(f, proyecto.servicio.codigo).listoParaJefatura;
  return {
    proyecto,
    contexto: {
      ingreso: f?.ingresoFechaIngreso ?? null,
      cierreProyectado: f?.ingresoFechaCierre ?? null,
      ejecucion: f?.ingresoServicioEjecucion ?? null,
      tiempoExpressMeses: f?.ingresoTiempoExpresMeses ?? null,
      subtipoCrudo: proyecto.servicio.codigo === 'CR' ? f?.ingresoServicioSubtipoCrudo ?? null : null,
      capitulos: f?.capitulosPactados ?? null,
      paginas: f?.paginasPactadas ?? null,
      presupuesto: f?.ingresoServicioPresupuesto ?? datos.presupuesto,
      alianza: f?.ingresoServicioAlianza ?? null,
      unidad: datos.unidad,
      comercial: comercial ? 'Completo' : 'Pendiente',
      rrpp: datos.p.notificadoJefatura ? 'Completo' : !datos.p.notificadoRrpp ? 'Aún no habilitado' : rrpp ? 'Listo para Jefatura' : 'En diagnóstico',
    },
    candidatos: ordenarCandidatos(snapshot.teamCapacity).map((c) => {
      const esActual = c.id === proyecto.especialista?.id;
      const impactoCarga = esActual ? 0 : proyecto.impactoCarga;
      const recomendado = proyecto.recomendacion?.especialistaId === c.id;
      return {
        ...c,
        esActual,
        impactoCarga,
        cargaProyectada: c.carga + impactoCarga,
        recomendado,
        razones: recomendado ? proyecto.recomendacion!.razones : [],
      };
    }),
  };
}
