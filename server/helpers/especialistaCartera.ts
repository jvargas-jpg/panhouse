import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs, capitulos, direccionesCreativas, disenos, disenoVersiones, pausas, proyectos, servicios } from '../db/schema/index.js';
import { obtenerInicioEspecialista } from './especialistaInicio.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { NOMBRES_PROCESO } from './jefatura.js';
import type { EspecialistaCartera, FiltrosCartera, ProyectoCartera, TabCartera } from '../../shared/especialistaCartera.js';

const estados = { en_proceso: 'En proceso', retrasado: 'Retrasado', pausado: 'Pausado', stand_by: 'Stand-by', culminado: 'Cerrado' };
const activo = (p: ProyectoCartera) => ESTADOS_ACTIVOS.includes(p.estado as typeof ESTADOS_ACTIVOS[number]);
const texto = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
export function perteneceTab(p: ProyectoCartera, tab: TabCartera): boolean {
  if (tab === 'cerrados') return p.estado === 'culminado';
  if (!activo(p)) return false;
  return tab === 'todos' || (tab === 'accion' && p.accionesPendientes > 0) || (tab === 'riesgo' && p.riesgo.atencion) || (tab === 'express' && p.express) || (tab === 'pausados' && p.pausado) || (tab === 'por-iniciar' && p.porIniciar);
}

// Solo se envía una página de DTOs de cartera. Snapshot y atención son los
// mismos del Inicio; riesgo, Express y procesos no se vuelven a definir aquí.
export async function obtenerCarteraEspecialista(actorId: string, filtros: FiltrosCartera, ahora = new Date()): Promise<EspecialistaCartera> {
  const snapshot = await obtenerInicioEspecialista(actorId, ahora);
  // No convertir una lectura fallida de acciones en un saludable cero.
  if (snapshot.errores.includes('acciones')) throw Object.assign(new Error('No se pudo consultar la atención de tu cartera'), { statusCode: 503 });
  const ids = snapshot.proyectos.map(p => p.id);
  const [catalogo, hechos, pausasAbiertas, cierres, esperaAutor, esperaCreativa, esperaDiseno] = await Promise.all([
    db.select({ id: servicios.id, codigo: servicios.codigo, nombre: servicios.nombre }).from(servicios).orderBy(servicios.nombre),
    ids.length ? db.select({ id: proyectos.id, inicio: proyectos.fechaRealInicio,
      // Calificar explícitamente: Drizzle descalifica Column en selecciones
      // de una tabla, lo que dentro del subquery haría referencia a wi.id.
      operativo: sql<boolean>`EXISTS (SELECT 1 FROM work_items wi WHERE wi.proyecto_id="proyectos"."id" AND wi.tipo NOT IN ('intake_rrpp','asignacion_especialista') AND wi.estado <> 'cancelado')`,
    }).from(proyectos).where(inArray(proyectos.id, ids)) : Promise.resolve([]),
    ids.length ? db.select({ proyectoId: pausas.proyectoId }).from(pausas).where(and(inArray(pausas.proyectoId, ids), isNull(pausas.fechaFin), eq(pausas.esPausadoFormal, true))) : Promise.resolve([]),
    ids.length ? db.selectDistinctOn([auditLogs.proyectoId], { proyectoId: auditLogs.proyectoId, responsable: sql<string | null>`${auditLogs.detalles}->>'especialistaId'` }).from(auditLogs)
      .where(and(inArray(auditLogs.proyectoId, ids), eq(auditLogs.accion, 'PROYECTO_ESTADO_CAMBIADO'), sql`${auditLogs.detalles}->>'nuevo'='culminado'`, sql`${auditLogs.createdAt} <= ${ahora.toISOString()}::timestamptz`))
      .orderBy(auditLogs.proyectoId, desc(auditLogs.createdAt), desc(auditLogs.id)) : Promise.resolve([]),
    ids.length ? db.selectDistinct({ proyectoId: capitulos.proyectoId }).from(capitulos).where(and(inArray(capitulos.proyectoId, ids), sql`${capitulos.fechaEnvioAutor} IS NOT NULL`, isNull(capitulos.fechaRespuestaReal))) : Promise.resolve([]),
    ids.length ? db.selectDistinct({ proyectoId: direccionesCreativas.proyectoId }).from(direccionesCreativas).where(and(inArray(direccionesCreativas.proyectoId, ids), sql`${direccionesCreativas.fechaBriefEnviadoAutor} IS NOT NULL`, isNull(direccionesCreativas.fechaBriefAprobadoAutor), isNull(direccionesCreativas.fechaCierre))) : Promise.resolve([]),
    // Únicamente la versión vigente: una versión antigua pendiente no crea una espera falsa.
    ids.length ? db.selectDistinctOn([disenos.id], { proyectoId: disenos.proyectoId, enviado: disenoVersiones.enviadaAutorEn, aprobado: disenoVersiones.aprobadaAutorEn, feedback: disenoVersiones.feedbackEn }).from(disenos)
      .innerJoin(disenoVersiones, eq(disenoVersiones.disenoId, disenos.id)).where(inArray(disenos.proyectoId, ids)).orderBy(disenos.id, desc(disenoVersiones.numero)) : Promise.resolve([]),
  ]);
  const porId = new Map(hechos.map(h => [h.id, h]));
  const pausados = new Set(pausasAbiertas.map(p => p.proyectoId));
  const responsablesCierre = new Map(cierres.map(c => [c.proyectoId, c.responsable]));
  const autor = new Set([...esperaAutor, ...esperaCreativa, ...esperaDiseno.filter(v => v.enviado && !v.aprobado && !v.feedback)].map(v => v.proyectoId));
  const acciones = new Map<string, typeof snapshot.acciones>();
  for (const a of snapshot.acciones) { const lista = acciones.get(a.proyectoId) ?? []; lista.push(a); acciones.set(a.proyectoId, lista); }
  const filas: ProyectoCartera[] = snapshot.proyectos
    .filter(p => p.estado !== 'culminado' || !responsablesCierre.has(p.id) || responsablesCierre.get(p.id) === actorId)
    .map(p => {
      const pendientes = acciones.get(p.id) ?? [];
      const hecho = porId.get(p.id);
      const abierto = ESTADOS_ACTIVOS.includes(p.estado as typeof ESTADOS_ACTIVOS[number]);
      const espera = !abierto ? null : autor.has(p.id) ? 'Esperando respuesta del autor' : p.procesos.some(t => t.decisionId) ? 'Esperando decisión de Jefatura' : p.procesos.length ? 'Esperando a '+[...new Set(p.procesos.map(t => t.responsable ?? (t.tipo === 'edicion' && t.estado === 'pendiente' ? 'Jefatura de Edición' : t.nombre)))].join(', ') : null;
      return { id: p.id, codigo: p.codigo, titulo: p.titulo, autores: p.autores, estado: p.estado,
        servicio: { id: p.servicio.id, codigo: p.servicio.codigo, nombre: p.servicio.codigo === 'CR' && p.subtipoCrudo ? (p.servicio.nombreCatalogo ?? 'Crudo')+' · '+p.subtipoCrudo : p.servicio.nombre }, subtipoCrudo: p.subtipoCrudo,
        procesos: p.procesos, fechaObjetivo: p.fechaObjetivo ?? null, riesgo: p.riesgo, express: p.express.estado === 'confirmado',
        pausado: abierto && (p.estado === 'pausado' || pausados.has(p.id)),
        porIniciar: p.estado === 'en_proceso' && !!hecho && !hecho.inicio && !hecho.operativo,
        objetivoMes: null, proximaAccion: pendientes[0] ?? null, accionesPendientes: pendientes.length, espera,
      };
    });
  const activos = filas.filter(activo);
  const contadores = Object.fromEntries(['todos','accion','riesgo','express','pausados','por-iniciar','cerrados'].map(t => [t, filas.filter(p => perteneceTab(p, t as TabCartera)).length])) as Record<TabCartera, number>;
  const buscar = texto(filtros.search.trim());
  const seleccion = filas.filter(p => perteneceTab(p, filtros.tab))
    .filter(p => !buscar || texto([p.titulo, p.autores, p.codigo].join(' ')).includes(buscar))
    .filter(p => !filtros.servicio || p.servicio.id === filtros.servicio)
    .filter(p => !filtros.subtipo || (p.servicio.codigo === 'CR' && p.subtipoCrudo === filtros.subtipo))
    .filter(p => !filtros.estado || p.estado === filtros.estado)
    .filter(p => !filtros.proceso || p.procesos.some(t => t.tipo === filtros.proceso))
    .filter(p => !filtros.riesgo || p.riesgo.atencion === (filtros.riesgo === 'si'));
  const creado = new Map(snapshot.proyectos.map(p => [p.id, p.creadoEn]));
  const fecha = (p: ProyectoCartera) => p.fechaObjetivo ?? '9999-12-31';
  seleccion.sort((a,b) => {
    const porFecha = fecha(a).localeCompare(fecha(b));
    const orden = filtros.orden === 'fecha' ? porFecha : filtros.orden === 'recientes' ? creado.get(b.id)!.localeCompare(creado.get(a.id)!) : filtros.orden === 'autor' ? a.autores.localeCompare(b.autores, 'es') :
      Number(b.proximaAccion?.prioridad === 'vencida')-Number(a.proximaAccion?.prioridad === 'vencida') || Number(b.riesgo.atencion)-Number(a.riesgo.atencion) || Number(b.accionesPendientes > 0)-Number(a.accionesPendientes > 0) || Number(b.express)-Number(a.express) || porFecha;
    return orden || a.id.localeCompare(b.id);
  });
  const total = seleccion.length, pages = Math.max(1, Math.ceil(total/filtros.pageSize)), page = Math.min(filtros.page, pages);
  const tipos = [...new Set(activos.flatMap(p => p.procesos.map(t => t.tipo)))].sort();
  return { actualizadoEn: ahora.toISOString(), resumen: { asignados: activos.length, ejecucion: activos.filter(p => !p.pausado && !p.porIniciar && ['en_proceso','retrasado'].includes(p.estado)).length,
    atencion: contadores.accion, riesgo: contadores.riesgo, express: contadores.express }, contadores,
    catalogos: { servicios: catalogo, procesos: tipos.map(tipo => ({ tipo, nombre: NOMBRES_PROCESO[tipo] ?? 'Proceso editorial' })), estados: Object.entries(estados).map(([valor,nombre]) => ({ valor,nombre })) },
    objetivos: snapshot.objetivos, proyectos: seleccion.slice((page-1)*filtros.pageSize, page*filtros.pageSize), total, page, pageSize: filtros.pageSize, pages };
}
