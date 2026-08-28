import { db } from '../../server/db/client.js';
import type { CausaPausa, EstadoProyecto, Rol } from '../../server/db/schema/index.js';
import { autores, pagos, pausas, presupuestos, proyectos, seguimientoFases, servicios, unidades, users } from '../../server/db/schema/index.js';
import { hashPassword } from '../../server/helpers/password.js';

let contador = 0;
function siguiente(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${contador}`;
}

function unaFila<T>(filas: T[]): T {
  const [fila] = filas;
  if (!fila) throw new Error('El insert de prueba no devolvió ninguna fila');
  return fila;
}

export async function crearUnidad() {
  return unaFila(
    await db
      .insert(unidades)
      .values({ nombre: siguiente('unidad') })
      .returning(),
  );
}

export async function crearPresupuesto() {
  return unaFila(
    await db
      .insert(presupuestos)
      .values({ nombre: siguiente('presupuesto') })
      .returning(),
  );
}

export async function crearAutor() {
  return unaFila(
    await db
      .insert(autores)
      .values({ nombre: siguiente('autor') })
      .returning(),
  );
}

export async function crearServicio(datos: {
  codigo: string;
  nombre: string;
  pesoComplejidad: number;
  plazoDias?: number;
  plazoInternoDias?: number;
  plazoComercialDias?: number;
}) {
  return unaFila(await db.insert(servicios).values(datos).returning());
}

export async function crearUsuario(rol: Rol = 'especialista') {
  const email = `${siguiente('usuario')}@panhouse.test`;
  const passwordHash = await hashPassword('password123');
  return unaFila(await db.insert(users).values({ email, passwordHash, nombre: email, rol }).returning());
}

export async function crearProyecto(datos: {
  autorId: string;
  servicioId: string;
  unidadId: string;
  presupuestoId: string;
  especialistaId?: string;
  editorId?: string;
  disenadorId?: string;
  calidadId?: string;
  digitalId?: string;
  lanzamientoId?: string;
  distribucionId?: string;
  estado?: EstadoProyecto;
  fechaProgramadaInicio: string;
  fechaRealInicio?: string;
  fechaDeseadaAutor?: string;
}) {
  return unaFila(await db.insert(proyectos).values(datos).returning());
}

// Junta autor + unidad + presupuesto + servicio + proyecto en una sola
// llamada: setup repetido por casi todos los tests de trazabilidad, que
// no necesitan variar estos catálogos, solo tener un proyecto válido.
export async function crearProyectoDePrueba(
  datos: Partial<{
    especialistaId: string;
    editorId: string;
    disenadorId: string;
    calidadId: string;
    digitalId: string;
    lanzamientoId: string;
    distribucionId: string;
    estado: EstadoProyecto;
  }> = {},
) {
  const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
  const servicio = await crearServicio({ codigo: siguiente('SRV'), nombre: 'Servicio de prueba', pesoComplejidad: 4, plazoDias: 180 });

  return crearProyecto({
    autorId: autor.id,
    servicioId: servicio.id,
    unidadId: unidad.id,
    presupuestoId: presupuesto.id,
    fechaProgramadaInicio: '2026-01-01',
    ...datos,
  });
}

export async function crearRegistroSeguimiento(datos: { proyectoId: string; analistaId?: string; estatus?: string }) {
  return unaFila(
    await db
      .insert(seguimientoFases)
      .values({ proyectoId: datos.proyectoId, analistaId: datos.analistaId, estatus: datos.estatus })
      .returning(),
  );
}

// Inserta directo, sin pasar por POST /api/pagos: los tests de
// PATCH /:id/verificar (tests/pagosProyecto.routes.test.ts) solo
// necesitan un pago ya existente en estatus 'Pendiente de verificación'
// (el default de la tabla), no probar de nuevo la ruta de creación.
export async function crearPagoDePrueba(datos: { proyectoId: string; monto?: string; metodoPago?: string; fechaPago?: string }) {
  return unaFila(
    await db
      .insert(pagos)
      .values({
        proyectoId: datos.proyectoId,
        monto: datos.monto ?? '100.00',
        metodoPago: datos.metodoPago ?? 'Zelle',
        fechaPago: datos.fechaPago ?? '2026-01-15',
      })
      .returning(),
  );
}

// Inserta directo, sin pasar por el guardián de negocio (validarPausaFormal
// en server/helpers/pausas.ts): sirve para dejar la base en un estado dado
// antes de probar otra cosa. Los tests que prueban la validación en sí
// deben usar crearPausa de server/helpers/pausas.ts, no esta función.
export async function insertarPausa(datos: {
  proyectoId: string;
  causa: CausaPausa;
  fechaInicio: Date;
  fechaFin?: Date | null;
  esPausadoFormal?: boolean;
  fechaLimiteRetoma?: string;
  recargoAplica?: boolean;
  pagoConfirmado?: boolean;
}) {
  return unaFila(await db.insert(pausas).values(datos).returning());
}
