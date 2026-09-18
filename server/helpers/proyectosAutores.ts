import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, proyectosAutores, type CategoriaCliente, type RedesSociales } from '../db/schema/index.js';

// Archivo aparte a propósito (no agregado a alertas.ts ni a
// proyectos.ts): la etapa aditiva de la migración a coautoría no debe
// tocar el join compartido de alertas.ts (mapearFilaConRiesgo /
// listarProyectosConRiesgo, usado también por "mis proyectos" del
// especialista/editor y por el panel de jefatura — ninguno de los dos
// está en el alcance de este cambio todavía). Estas funciones solo las
// usan crearProyecto (helpers/proyectos.ts, para el alta) y las dos
// rutas explícitamente migradas (GET /api/proyectos y GET
// /api/proyectos/:id/riesgo, en proyectos.routes.ts).

// nombreArtistico viaja también en el listado en lote (no solo en el
// perfil completo de abajo): el nombre visual del proyecto en listas
// (ProyectosPendientesCrmList.tsx, ProyectoDetallePage.tsx) se arma con
// autores + codigo, y usa el nombre artístico cuando existe — el mismo
// criterio que ya aplicaba TarjetaPerfilAutores para el detalle.
export interface AutorDeProyecto {
  id: string;
  nombre: string;
  nombreArtistico: string | null;
}

// Distinto de AutorDeProyecto a propósito: solo obtenerAutoresDeProyecto
// (detalle de un proyecto puntual) necesita el perfil completo del
// autor — ProyectoDetallePage.tsx lo muestra de solo lectura (tarjeta
// "Perfil del Autor") ahora que la ficha de trazabilidad ya no pide
// estos datos como inputs propios (ver schema/trazabilidad.ts). El
// listado en lote (obtenerAutoresPorProyectos, GET /api/proyectos) no
// necesita el resto del perfil — solo nombreArtistico, para el nombre
// visual (ver el comentario de AutorDeProyecto arriba).
export interface AutorDeProyectoConPerfil extends AutorDeProyecto {
  nacionalidad: string[] | null;
  fechaNacimiento: string | null;
  redesSociales: RedesSociales | null;
  personalidad: string[] | null;
  ocupacion: string | null;
  // Ver server/db/schema/enums.ts: cerrado a 'Estándar'/'VIP',
  // TarjetaPerfilAutores (SeccionProyectoPerfil.tsx) lo muestra como
  // badge junto al nombre artístico de cada autor.
  categoria: CategoriaCliente;
  // "País de residencia" (Bloque 1, Datos Sincronizados) en
  // SeccionMatrizIngreso.tsx — antes ausente acá, causaba un mismatch de
  // tipos silencioso porque la verificación de tipos del frontend corría
  // sobre el tsconfig "solución" equivocado (sin archivos, ver
  // frontend/tsconfig.json) en vez de tsconfig.app.json.
  pais: string | null;
}

// La inserción de la fila de coautoría vive directo en crearProyecto
// (helpers/proyectos.ts), no acá: siempre corre dentro de la misma
// transacción que crea el proyecto, mismo criterio que el resto de este
// código base (ningún otro helper transaccional delega su `tx` a una
// función aparte — ver notificarRrppProyectoBase para el patrón).

// Detalle de un proyecto puntual (GET /api/proyectos/:id/riesgo).
export async function obtenerAutoresDeProyecto(proyectoId: string): Promise<AutorDeProyectoConPerfil[]> {
  const filas = await db
    .select({
      id: autores.id,
      nombre: autores.nombre,
      nombreArtistico: autores.nombreArtistico,
      nacionalidad: autores.nacionalidad,
      fechaNacimiento: autores.fechaNacimiento,
      redesSociales: autores.redesSociales,
      personalidad: autores.personalidad,
      ocupacion: autores.ocupacion,
      categoria: autores.categoria,
      pais: autores.pais,
    })
    .from(proyectosAutores)
    .innerJoin(autores, eq(proyectosAutores.autorId, autores.id))
    .where(eq(proyectosAutores.proyectoId, proyectoId));

  return filas;
}

// Versión en lote para listados (GET /api/proyectos): una sola consulta
// para todos los proyectos de la página en vez de N+1. Devuelve un Map
// proyectoId -> autores para que el caller arme cada fila.
export async function obtenerAutoresPorProyectos(proyectoIds: string[]): Promise<Map<string, AutorDeProyecto[]>> {
  const mapa = new Map<string, AutorDeProyecto[]>();
  if (proyectoIds.length === 0) return mapa;

  const filas = await db
    .select({
      proyectoId: proyectosAutores.proyectoId,
      id: autores.id,
      nombre: autores.nombre,
      nombreArtistico: autores.nombreArtistico,
    })
    .from(proyectosAutores)
    .innerJoin(autores, eq(proyectosAutores.autorId, autores.id))
    .where(inArray(proyectosAutores.proyectoId, proyectoIds));

  for (const fila of filas) {
    const lista = mapa.get(fila.proyectoId) ?? [];
    lista.push({ id: fila.id, nombre: fila.nombre, nombreArtistico: fila.nombreArtistico });
    mapa.set(fila.proyectoId, lista);
  }
  return mapa;
}
