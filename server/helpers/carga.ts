import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { EstadoProyecto } from '../db/schema/index.js';
import { proyectos, servicios, users } from '../db/schema/index.js';

// Un proyecto cuenta para la carga de quien esté asignado mientras no
// esté cerrado. "pausado" y "stand_by" siguen contando: el proyecto
// sigue asignado aunque hoy no avance. Se exporta porque
// listarRiesgoProyectosActivos (server/helpers/alertas.ts) reutiliza el
// mismo concepto de "proyecto activo".
export const ESTADOS_ACTIVOS: EstadoProyecto[] = ['en_proceso', 'retrasado', 'stand_by', 'pausado'];

export function calcularCarga(pesosComplejidad: number[]): number {
  return pesosComplejidad.reduce((total, peso) => total + peso, 0);
}

// Roles que hoy tienen proyectos asignados uno a uno (carga ponderada,
// "mis proyectos"), y la columna de `proyectos` que guarda esa
// asignación para cada uno. Mismo peso de complejidad del servicio para
// los tres (un EF de 180 días pesa más que un SE de 90, sea quien sea
// quien lo tenga asignado) — lo único que cambia es a quién se le
// atribuye. Se exporta porque listarProyectosConRiesgo
// (server/helpers/alertas.ts) reutiliza el mismo concepto para "mis
// proyectos" del especialista/editor, no solo para la carga.
export const ROLES_CON_CARGA = ['especialista', 'editor', 'disenador'] as const;
export type RolConCarga = (typeof ROLES_CON_CARGA)[number];

export function columnaAsignacion(rol: RolConCarga) {
  if (rol === 'especialista') return proyectos.especialistaId;
  if (rol === 'editor') return proyectos.editorId;
  return proyectos.disenadorId;
}

export async function obtenerCargaUsuario(usuarioId: string, rol: RolConCarga): Promise<number> {
  const filas = await db
    .select({ pesoComplejidad: servicios.pesoComplejidad })
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(eq(columnaAsignacion(rol), usuarioId), inArray(proyectos.estado, ESTADOS_ACTIVOS)));

  return calcularCarga(filas.map((fila) => fila.pesoComplejidad));
}

export interface CargaUsuario {
  id: string;
  nombre: string;
  email: string;
  carga: number;
}

// Para que jefe_area (especialistas) o jefe_edicion (editores) vean de
// un vistazo quién tiene más trabajo antes de asignar un proyecto
// nuevo. Reutiliza obtenerCargaUsuario por cada persona en vez de
// reimplementar la suma con un JOIN propio. Ordenado de mayor a menor
// carga: es justo lo que quien reparte trabajo necesita ver primero,
// no un orden incidental de la consulta.
export async function listarCargaPorRol(rol: RolConCarga): Promise<CargaUsuario[]> {
  const usuarios = await db.select({ id: users.id, nombre: users.nombre, email: users.email }).from(users).where(eq(users.rol, rol));

  const conCarga = await Promise.all(
    usuarios.map(async (usuario) => ({
      ...usuario,
      carga: await obtenerCargaUsuario(usuario.id, rol),
    })),
  );

  return conCarga.sort((a, b) => b.carga - a.carga);
}

// --- Nombres específicos que ya usa el resto del sistema (rutas de
// especialistas, tests) — delegan al cálculo generalizado de arriba,
// no lo duplican. No se renombran para no tocar los call sites
// existentes fuera del alcance de esta ronda.
export type CargaEspecialista = CargaUsuario;
export const calcularCargaEspecialista = calcularCarga;

export function obtenerCargaEspecialista(especialistaId: string): Promise<number> {
  return obtenerCargaUsuario(especialistaId, 'especialista');
}

export function listarCargaEspecialistas(): Promise<CargaUsuario[]> {
  return listarCargaPorRol('especialista');
}

// --- Equivalentes para editor (esta ronda).
export type CargaEditor = CargaUsuario;

export function obtenerCargaEditor(editorId: string): Promise<number> {
  return obtenerCargaUsuario(editorId, 'editor');
}

export function listarCargaEditores(): Promise<CargaUsuario[]> {
  return listarCargaPorRol('editor');
}

// --- Equivalentes para disenador: lo usa el especialista dueño del
// proyecto para elegir a quién asignar (ver PATCH /proyectos/:id/disenador).
export type CargaDisenador = CargaUsuario;

export function obtenerCargaDisenador(disenadorId: string): Promise<number> {
  return obtenerCargaUsuario(disenadorId, 'disenador');
}

export function listarCargaDisenadores(): Promise<CargaUsuario[]> {
  return listarCargaPorRol('disenador');
}
