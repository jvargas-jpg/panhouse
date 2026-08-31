import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { EstadoProyecto } from '../db/schema/index.js';
import { autores, proyectos, servicios } from '../db/schema/index.js';
import { columnaAsignacion, ESTADOS_ACTIVOS, type RolConCarga } from './carga.js';
import { calcularDiasEfectivosProyecto } from './pausas.js';

export interface PlazosServicio {
  plazoDias: number | null;
  plazoInternoDias: number | null;
  plazoComercialDias: number | null;
}

export interface RiesgoProyecto {
  diasEfectivosTranscurridos: number;
  diasPlazo: number;
  diasRestantes: number;
  vencido: boolean;
  // Aviso temprano: aún no vence, pero ya consumió el umbral del plazo.
  enRiesgo: boolean;
}

// El plazo que dispara la alerta es siempre el interno para SE (meta
// de 60 días de seguimiento), y el único plazo para el resto de
// servicios. El compromiso comercial de SE (90 días) es lo que se le
// promete al autor, no lo que activa esta alerta.
export function determinarDiasPlazoAlerta(servicio: PlazosServicio): number {
  if (servicio.plazoInternoDias != null) return servicio.plazoInternoDias;
  if (servicio.plazoDias != null) return servicio.plazoDias;
  throw new Error('Servicio sin plazo configurado (falta plazoDias o plazoInternoDias)');
}

export function evaluarRiesgo(
  diasEfectivosTranscurridos: number,
  diasPlazo: number,
  umbralRiesgo = 0.8,
): RiesgoProyecto {
  const diasRestantes = diasPlazo - diasEfectivosTranscurridos;
  const vencido = diasEfectivosTranscurridos > diasPlazo;
  const enRiesgo = !vencido && diasEfectivosTranscurridos >= diasPlazo * umbralRiesgo;

  return { diasEfectivosTranscurridos, diasPlazo, diasRestantes, vencido, enRiesgo };
}

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export async function evaluarRiesgoProyecto(
  proyectoId: string,
  ahora: Date = new Date(),
  umbralRiesgo = 0.8,
): Promise<RiesgoProyecto> {
  const [fila] = await db
    .select({
      fechaProgramadaInicio: proyectos.fechaProgramadaInicio,
      fechaRealInicio: proyectos.fechaRealInicio,
      plazoDias: servicios.plazoDias,
      plazoInternoDias: servicios.plazoInternoDias,
      plazoComercialDias: servicios.plazoComercialDias,
    })
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(eq(proyectos.id, proyectoId))
    .limit(1);

  if (!fila) {
    throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  }

  const fechaInicio = parseFecha(fila.fechaRealInicio ?? fila.fechaProgramadaInicio);
  const diasPlazo = determinarDiasPlazoAlerta({
    plazoDias: fila.plazoDias,
    plazoInternoDias: fila.plazoInternoDias,
    plazoComercialDias: fila.plazoComercialDias,
  });

  const diasEfectivos = await calcularDiasEfectivosProyecto(proyectoId, fechaInicio, ahora, ahora);

  return evaluarRiesgo(diasEfectivos, diasPlazo, umbralRiesgo);
}

export interface ProyectoConRiesgo {
  id: string;
  titulo: string | null;
  estado: EstadoProyecto;
  fechaProgramadaInicio: string;
  fechaRealInicio: string | null;
  fechaDeseadaAutor: string | null;
  disenadorId: string | null;
  especialistaId: string | null;
  editorId: string | null;
  correctorId: string | null;
  calidadId: string | null;
  digitalId: string | null;
  lanzamientoId: string | null;
  distribucionId: string | null;
  // Botones "Notificar a RRPP" / "Notificar a Jefatura" de Fase 1 -
  // Inicio (ProyectoDetallePage.tsx): sin esto viajando acá, el
  // frontend no tendría cómo saber cuál de los dos ya se disparó, y el
  // botón correspondiente no podría quedar deshabilitado ("Notificado")
  // tras recargar la página.
  notificadoRrpp: boolean;
  notificadoJefatura: boolean;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
  riesgo: RiesgoProyecto;
}

// Columnas compartidas por las tres funciones de abajo: listar (mías /
// todas las activas) y obtener una sola por id. Solo cambia el WHERE.
// Las columnas de asignación viajan acá (y no solo en la fila cruda de
// proyectos) para que el frontend pueda decidir sin un segundo fetch:
// ProyectoDetallePage.tsx usa disenadorId para el mini-form de
// asignación de Diseño y las cinco juntas para SeccionEquipo.tsx
// ("Escuadrón de Producción"); PanelJefaturaPage.tsx usa especialistaId
// para partir la bandeja de jefatura en "nuevos por asignar" vs. "en curso".
const COLUMNAS_PROYECTO_CON_AUTOR_Y_SERVICIO = {
  id: proyectos.id,
  titulo: proyectos.titulo,
  estado: proyectos.estado,
  fechaProgramadaInicio: proyectos.fechaProgramadaInicio,
  fechaRealInicio: proyectos.fechaRealInicio,
  fechaDeseadaAutor: proyectos.fechaDeseadaAutor,
  disenadorId: proyectos.disenadorId,
  especialistaId: proyectos.especialistaId,
  editorId: proyectos.editorId,
  correctorId: proyectos.correctorId,
  calidadId: proyectos.calidadId,
  digitalId: proyectos.digitalId,
  lanzamientoId: proyectos.lanzamientoId,
  distribucionId: proyectos.distribucionId,
  notificadoRrpp: proyectos.notificadoRrpp,
  notificadoJefatura: proyectos.notificadoJefatura,
  autorId: autores.id,
  autorNombre: autores.nombre,
  servicioId: servicios.id,
  servicioCodigo: servicios.codigo,
  servicioNombre: servicios.nombre,
} as const;

type FilaProyectoConAutorYServicio = {
  id: string;
  titulo: string | null;
  estado: EstadoProyecto;
  fechaProgramadaInicio: string;
  fechaRealInicio: string | null;
  fechaDeseadaAutor: string | null;
  disenadorId: string | null;
  especialistaId: string | null;
  editorId: string | null;
  correctorId: string | null;
  calidadId: string | null;
  digitalId: string | null;
  lanzamientoId: string | null;
  distribucionId: string | null;
  notificadoRrpp: boolean;
  notificadoJefatura: boolean;
  autorId: string;
  autorNombre: string;
  servicioId: string;
  servicioCodigo: string;
  servicioNombre: string;
};

async function mapearFilaConRiesgo(fila: FilaProyectoConAutorYServicio): Promise<ProyectoConRiesgo> {
  return {
    id: fila.id,
    titulo: fila.titulo,
    estado: fila.estado,
    fechaProgramadaInicio: fila.fechaProgramadaInicio,
    fechaRealInicio: fila.fechaRealInicio,
    fechaDeseadaAutor: fila.fechaDeseadaAutor,
    disenadorId: fila.disenadorId,
    especialistaId: fila.especialistaId,
    editorId: fila.editorId,
    correctorId: fila.correctorId,
    calidadId: fila.calidadId,
    digitalId: fila.digitalId,
    lanzamientoId: fila.lanzamientoId,
    distribucionId: fila.distribucionId,
    notificadoRrpp: fila.notificadoRrpp,
    notificadoJefatura: fila.notificadoJefatura,
    autor: { id: fila.autorId, nombre: fila.autorNombre },
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
    riesgo: await evaluarRiesgoProyecto(fila.id),
  };
}

// Base compartida por "mis proyectos" (especialista o editor) y por la
// lista general para jefe_area/dirección (sin filtro): trae autor y
// servicio ya resueltos (join) y el riesgo ya calculado por fila, para
// que el frontend pinte listas completas sin una llamada por proyecto
// — mismo concepto de "activo" que la carga (ver carga.ts). Un proyecto
// pausado sigue apareciendo porque su cálculo de días efectivos ya
// excluye el tiempo en pausa. La columna a filtrar (especialistaId o
// editorId) depende del rol de quien pregunta — mismo parámetro
// rol+usuarioId que ya usa obtenerCargaUsuario, para no reimplementar
// el mapeo rol→columna dos veces.
async function listarProyectosConRiesgo(asignacion?: { rol: RolConCarga; usuarioId: string }): Promise<ProyectoConRiesgo[]> {
  const condiciones = [inArray(proyectos.estado, ESTADOS_ACTIVOS)];
  if (asignacion) {
    condiciones.push(eq(columnaAsignacion(asignacion.rol), asignacion.usuarioId));
  }

  const filas = await db
    .select(COLUMNAS_PROYECTO_CON_AUTOR_Y_SERVICIO)
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(...condiciones));

  return Promise.all(filas.map(mapearFilaConRiesgo));
}

// "Mis proyectos" para la pantalla del especialista.
export function listarProyectosEspecialista(especialistaId: string): Promise<ProyectoConRiesgo[]> {
  return listarProyectosConRiesgo({ rol: 'especialista', usuarioId: especialistaId });
}

// "Mis proyectos" para la pantalla del editor — mismo concepto, otra columna.
export function listarProyectosEditor(editorId: string): Promise<ProyectoConRiesgo[]> {
  return listarProyectosConRiesgo({ rol: 'editor', usuarioId: editorId });
}

// Para jefe_area/dirección: todos los proyectos activos, no solo los
// de una persona puntual.
export function listarRiesgoProyectosActivos(): Promise<ProyectoConRiesgo[]> {
  return listarProyectosConRiesgo();
}

// Para la pantalla de detalle de un proyecto puntual: a diferencia de
// las dos funciones de arriba, NO filtra por "activo" — un especialista
// debe poder ver el detalle de un proyecto culminado o retirado, no
// solo de los que siguen en curso.
export async function obtenerProyectoConRiesgo(proyectoId: string): Promise<ProyectoConRiesgo | undefined> {
  const [fila] = await db
    .select(COLUMNAS_PROYECTO_CON_AUTOR_Y_SERVICIO)
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(eq(proyectos.id, proyectoId))
    .limit(1);

  if (!fila) return undefined;
  return mapearFilaConRiesgo(fila);
}
