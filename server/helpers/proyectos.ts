import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { CategoriaStandBy, EstadoProyecto, Rol } from '../db/schema/index.js';
import { autores, fichasTrazabilidad, notificaciones, proyectos, proyectosAutores, servicios } from '../db/schema/index.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { obtenerAutoresPorProyectos, type AutorDeProyecto } from './proyectosAutores.js';

// Reexportadas desde alertas.ts: comparten el join autor/servicio/riesgo
// con listarRiesgoProyectosActivos (jefe_area/dirección) en vez de
// duplicar la consulta — ver ese archivo para la implementación real.
export { listarProyectosEditor, listarProyectosEspecialista } from './alertas.js';

export interface DatosNuevoProyecto {
  autorIds: string[];
  servicioId: string;
  unidadId: string;
  presupuestoId: string;
  coleccionId?: string | null;
  fechaProgramadaInicio: string;
  fechaRealInicio?: string | null;
  fechaDeseadaAutor?: string | null;
}

// 6 caracteres hexadecimales de un UUID v4 real (no un contador ni un
// timestamp) — mismo criterio que sugiere el negocio: suficiente
// entropía para este volumen de proyectos sin sumar una dependencia
// nueva (nanoid) para un solo uso. proyectos.codigo es UNIQUE — el
// código Postgres de colisión (23505) es el único que crearProyecto
// reintenta abajo; cualquier otro error de la transacción se propaga tal cual.
function generarCodigoCorto(): string {
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

// Crea el proyecto y su ficha de trazabilidad vacía en la misma
// transacción: nunca debe quedar un proyecto sin ficha (ni una ficha
// huérfana) si algo falla a mitad de camino. especialistaId no se
// acepta aquí — se asigna aparte con asignarEspecialista, nunca se
// autoasigna a quien crea el proyecto.
//
// NO dispara ninguna notificación (a propósito, revertido tras una
// ronda anterior): un proyecto recién creado es solo un cascarón, la
// ficha todavía está vacía — alertar a jefe_area acá los mandaría a
// revisar algo sin contenido. Ver notificarJefaturaFichaCompletada más
// abajo, el disparador correcto (acción explícita del usuario al
// terminar de llenar Fase 1).
// La transacción entera se reintenta (no solo el insert) porque
// Postgres aborta toda la transacción en curso ante cualquier error,
// incluida una violación de unicidad — no hay forma de "seguir" con un
// nuevo codigo dentro de la misma tx una vez que falló. 5 intentos es
// generoso: con 6 hex de un UUID v4 real (16^6 ≈ 16.7M combinaciones)
// una colisión es prácticamente imposible al volumen de esta app;
// esto es una red de seguridad barata, no una mitigación de un riesgo
// real esperado.
const INTENTOS_CODIGO_UNICO = 5;

function esColisionDeCodigo(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505' &&
    'constraint' in error &&
    (error as { constraint?: unknown }).constraint === 'proyectos_codigo_unique'
  );
}

// Comercial (y jefe_area, que comparte el mismo formulario/endpoint de
// alta — no hay uno separado) solo elige la categoría general del
// servicio al crear un proyecto: Sello editorial, Escritura fantasma o
// Crudo. El resto del catálogo real (EEC/EET, hoy subsumidos por Crudo
// + ingresoServicioSubtipoCrudo — ver schema/enums.ts) sigue existiendo
// para proyectos legacy y para el <select> de corrección
// (PATCH /:id/reasignar, sin esta restricción).
const CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA = ['SE', 'EF', 'CR'] as const;

export type ResultadoCrearProyecto =
  | { ok: true; proyecto: Awaited<ReturnType<typeof crearProyectoConCodigo>> }
  | { ok: false; status: 400; error: string };

export async function crearProyecto(datos: DatosNuevoProyecto): Promise<ResultadoCrearProyecto> {
  const { autorIds, ...datosProyecto } = datos;
  // crearProyectoSchema ya exige al menos un id (.min(1)) — este guard
  // es solo para que TS sepa que autorPrincipal no es undefined, no una
  // validación de negocio real.
  const [autorPrincipal] = autorIds;
  if (!autorPrincipal) throw new Error('crearProyecto necesita al menos un autorId');

  const [servicio] = await db.select({ codigo: servicios.codigo }).from(servicios).where(eq(servicios.id, datosProyecto.servicioId)).limit(1);
  if (!servicio) {
    return { ok: false, status: 400, error: 'Servicio no encontrado' };
  }
  if (!CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA.includes(servicio.codigo as (typeof CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA)[number])) {
    return {
      ok: false,
      status: 400,
      error: 'Al crear un proyecto solo se puede elegir Sello editorial, Escritura fantasma o Crudo como servicio',
    };
  }

  for (let intento = 1; intento <= INTENTOS_CODIGO_UNICO; intento++) {
    try {
      const proyecto = await crearProyectoConCodigo(datosProyecto, autorPrincipal, autorIds);
      return { ok: true, proyecto };
    } catch (error) {
      if (!esColisionDeCodigo(error) || intento === INTENTOS_CODIGO_UNICO) throw error;
    }
  }
  // Inalcanzable en la práctica (el loop siempre retorna o lanza), pero
  // TS no puede probarlo — ver el `for` de arriba.
  throw new Error('No se pudo generar un código único para el proyecto');
}

async function crearProyectoConCodigo(
  datosProyecto: Omit<DatosNuevoProyecto, 'autorIds'>,
  autorPrincipal: string,
  autorIds: string[],
) {
  return db.transaction(async (tx) => {
    // Etapa aditiva de la migración a coautoría (ver proyectos_autores en
    // schema/proyectos.ts): proyectos.autorId (columna legacy, todavía
    // vigente) se sigue llenando con el PRIMER autor del array — es la
    // fila "principal" para todo el código que aún no migró a la tabla
    // de unión (control de acceso del Portal del Autor, riesgo, carga,
    // pagos, seguimiento). Los coautores adicionales solo quedan en
    // proyectos_autores, más abajo.
    const [proyecto] = await tx
      .insert(proyectos)
      .values({ ...datosProyecto, autorId: autorPrincipal, codigo: generarCodigoCorto() })
      .returning();
    if (!proyecto) throw new Error('El insert del proyecto no devolvió ninguna fila');

    // ingresoFechaIngreso arranca igual a fechaProgramadaInicio (misma
    // fecha, dos lugares donde se ve: acá en el alta de Comercial, y
    // editable dentro de la ficha del proyecto — ver el comentario en
    // actualizarSeccionProyectoPerfil sobre cómo se mantienen
    // sincronizadas después). Sin este seed, la ficha arrancaría con la
    // fecha vacía y ambos campos divergirían desde el día uno.
    await tx.insert(fichasTrazabilidad).values({ proyectoId: proyecto.id, ingresoFechaIngreso: datosProyecto.fechaProgramadaInicio });

    // Una fila por autor (coautoría real) — sin esto, todo proyecto
    // creado DESPUÉS de la migración quedaría sin autores en
    // GET /api/proyectos / GET /api/proyectos/:id/riesgo, que ya leen
    // de acá.
    await tx.insert(proyectosAutores).values(autorIds.map((autorId) => ({ proyectoId: proyecto.id, autorId })));

    return proyecto;
  });
}

export type ResultadoTransicionFase1 =
  | { ok: true }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 409; error: string };

// Paso 1 de la cascada de Fase 1 (Inicio): comercial termina de cargar
// los datos de venta y pasa el proyecto a rrpp para que llene la ficha
// de trazabilidad. notificadoRrpp como guardia de idempotencia — mismo
// criterio que notificarJefaturaFichaCompletada de abajo (el paso 2 de
// esta misma cascada): sin ella, dos clics generarían dos alertas para
// el mismo proyecto, y el botón no sabría que ya se envió al recargar.
export async function notificarRrppProyectoBase(proyectoId: string): Promise<ResultadoTransicionFase1> {
  return db.transaction(async (tx) => {
    const [proyecto] = await tx.select().from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1);
    if (!proyecto) {
      return { ok: false, status: 404, error: 'Proyecto no encontrado' };
    }
    if (proyecto.notificadoRrpp) {
      return { ok: false, status: 409, error: 'Este proyecto ya fue notificado a rrpp' };
    }

    // titulo ya no existe como campo manual (ver schema/proyectos.ts) —
    // el mensaje usa el codigo generado al crear el proyecto, siempre
    // presente, con el nombre del servicio como respaldo legible.
    const [servicio] = await tx.select({ nombre: servicios.nombre }).from(servicios).where(eq(servicios.id, proyecto.servicioId)).limit(1);

    await tx.update(proyectos).set({ notificadoRrpp: true }).where(eq(proyectos.id, proyectoId));
    await tx.insert(notificaciones).values({
      proyectoId: proyecto.id,
      rolDestino: 'rrpp',
      mensaje: `Nuevo proyecto base registrado, pendiente de Ficha de Trazabilidad: #${proyecto.codigo} — ${servicio?.nombre ?? 'servicio sin especificar'}`,
    });

    return { ok: true };
  });
}

// Paso 2 de la misma cascada: rrpp termina de llenar el Perfil y la
// Ficha Editorial (área exclusiva de rrpp, ahora en su propio módulo
// /proyectos/:id/ficha-trazabilidad, ver FichaTrazabilidadPage.tsx y
// SeccionFichaEditorial.tsx) y pasa el proyecto a jefe_area para
// asignación. notificadoJefatura como guardia de idempotencia — mismo
// criterio que notificarRrppProyectoBase de arriba. Botón "Mandar a
// Jefatura" en FichaTrazabilidadPage.tsx — a
// pedido explícito del negocio, el mensaje nombra a los autores en vez
// de solo el servicio (mismo criterio de nombre real/legal que el resto
// de la app, ver autores.nombre). Reutiliza este mismo endpoint/función
// de siempre (POST /api/proyectos/:id/notificar-jefatura) — no se creó
// una ruta paralela cuando el negocio lo volvió a pedir: ya hacía
// exactamente lo pedido (transacción con el update de notificadoJefatura
// + el insert en notificaciones), solo cambió el texto del mensaje.
export async function notificarJefaturaFichaCompletada(proyectoId: string): Promise<ResultadoTransicionFase1> {
  return db.transaction(async (tx) => {
    const [proyecto] = await tx.select().from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1);
    if (!proyecto) {
      return { ok: false, status: 404, error: 'Proyecto no encontrado' };
    }
    if (proyecto.notificadoJefatura) {
      return { ok: false, status: 409, error: 'La ficha de este proyecto ya fue notificada a jefatura' };
    }

    const filasAutores = await tx
      .select({ nombre: autores.nombre })
      .from(proyectosAutores)
      .innerJoin(autores, eq(proyectosAutores.autorId, autores.id))
      .where(eq(proyectosAutores.proyectoId, proyectoId));
    const nombresAutores = filasAutores.map((fila) => fila.nombre).join(', ') || 'Sin autor asignado';

    await tx.update(proyectos).set({ notificadoJefatura: true }).where(eq(proyectos.id, proyectoId));
    await tx.insert(notificaciones).values({
      proyectoId: proyecto.id,
      rolDestino: 'jefe_area',
      mensaje: `RRPP ha completado la Ficha Editorial del proyecto ${nombresAutores} - #${proyecto.codigo}. Listo para asignación al escuadrón.`,
    });

    return { ok: true };
  });
}

export async function obtenerProyecto(proyectoId: string) {
  const [fila] = await db.select().from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1);
  return fila;
}

export type AccesoProyecto =
  | { ok: true }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 403; error: string };

// Único punto que decide "¿puede este usuario ver este proyecto?" para
// las pantallas de detalle (riesgo, ficha, capítulos, pausas) y para las
// rutas de capítulos (crear, lado editor): jefe_area ve cualquiera; un
// especialista, un editor o un disenador, solo el proyecto donde está
// asignado en su columna correspondiente (especialistaId / editorId /
// disenadorId). Reutilizado en vez de repetir el mismo 404/403 en cada
// ruta. lider_creativo pasa de largo a propósito (sin rama propia) —
// mismo alcance que jefe_area sobre esta sección, para poder auditar
// cualquier proyecto.
export async function verificarAccesoAProyecto(
  proyectoId: string,
  usuario: { id: string; rol: Rol },
): Promise<AccesoProyecto> {
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (usuario.rol === 'especialista' && proyecto.especialistaId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  if (usuario.rol === 'editor' && proyecto.editorId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  if (usuario.rol === 'disenador' && proyecto.disenadorId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

// Chequeo específico de PATCH /:proyectoId/calidad-control (especialista
// dueño del proyecto, o cualquier soporte_editorial — a pedido explícito
// del negocio, calidadId (columna de dueño individual) se dio de baja:
// ya no hace falta ser "el" asignado, alcanza con el rol, mismo acceso
// de grupo que ya tenían el resto de las rutas de esta sección (ver
// listarProyectosPendientesCalidad/las rutas de /calidad/fases).
export async function verificarAccesoControlCalidad(
  proyectoId: string,
  usuario: { id: string; rol: Rol },
): Promise<AccesoProyecto> {
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (usuario.rol === 'especialista' && proyecto.especialistaId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

// Chequeo específico de PATCH /:proyectoId/digital-control (especialista
// dueño del proyecto, o cualquier soporte_digital — digitalId se dio de
// baja, mismo motivo y mismo acceso de grupo que verificarAccesoControlCalidad
// arriba).
export async function verificarAccesoControlDigital(
  proyectoId: string,
  usuario: { id: string; rol: Rol },
): Promise<AccesoProyecto> {
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (usuario.rol === 'especialista' && proyecto.especialistaId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

// Chequeo específico de PATCH /:proyectoId/lanzamiento-control (especialista
// dueño del proyecto, o cualquier rrpp — lanzamientoId se dio de baja,
// mismo motivo y mismo acceso de grupo que verificarAccesoControlCalidad/
// verificarAccesoControlDigital arriba).
export async function verificarAccesoControlLanzamiento(
  proyectoId: string,
  usuario: { id: string; rol: Rol },
): Promise<AccesoProyecto> {
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (usuario.rol === 'especialista' && proyecto.especialistaId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

// Chequeo específico de PATCH /:proyectoId/distribucion-control
// (especialista dueño del proyecto, o cualquier rrpp — distribucionId se
// dio de baja, mismo motivo y mismo acceso de grupo que los helpers
// aislados anteriores).
export async function verificarAccesoControlDistribucion(
  proyectoId: string,
  usuario: { id: string; rol: Rol },
): Promise<AccesoProyecto> {
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (usuario.rol === 'especialista' && proyecto.especialistaId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

export interface DatosActualizarProyecto {
  estado?: EstadoProyecto;
  categoriaStandBy?: CategoriaStandBy | null;
  coleccionId?: string | null;
  presupuestoId?: string;
  unidadId?: string;
  servicioId?: string;
  fechaRealInicio?: string | null;
  fechaDeseadaAutor?: string | null;
}

// 'pausado' es el único estado que exige el guardián de pago
// (validarPausaFormal en server/helpers/pausas.ts): solo se llega a él
// creando una pausa formal, nunca por esta ruta general. Los otros
// cinco estados (en_proceso, retrasado, stand_by, culminado, retirado)
// no tienen esa exigencia y siguen editables libremente aquí.
export function validarCambioEstadoProyecto(estado?: EstadoProyecto): void {
  if (estado === 'pausado') {
    throw new Error(
      "No se puede cambiar el estado a 'pausado' por esta vía — usa POST /api/pausas con esPausadoFormal=true, el único camino que verifica el pago.",
    );
  }
}

// Edición directa de las especificaciones operativas del proyecto,
// confirmada a cargo del especialista. "Especificaciones especiales"
// (jefe de área) queda como categoría abierta para más adelante: hoy
// ningún campo de proyectos cae ahí.
export async function actualizarProyecto(proyectoId: string, datos: DatosActualizarProyecto) {
  validarCambioEstadoProyecto(datos.estado);

  const [fila] = await db.update(proyectos).set(datos).where(eq(proyectos.id, proyectoId)).returning();
  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  return fila;
}

export interface DatosReasignarProyecto {
  autorId?: string;
  // Coautoría — reemplaza TODAS las filas de proyectos_autores del
  // proyecto por esta lista (no un "agregar"). Ver reasignarProyecto.
  autorIds?: string[];
  servicioId?: string;
  unidadId?: string;
  presupuestoId?: string;
  fechaProgramadaInicio?: string;
}

// Corregir a qué autor(es) está asociado un proyecto, su título, su
// tipo de servicio, o sus otros parámetros comerciales (unidad/
// presupuesto/fecha programada), después de creado — capacidad propia
// de comercial (ver PATCH /:id/reasignar). Deliberadamente separada de
// actualizarProyecto (especificaciones operativas, a cargo de
// especialista) — ver la nota de solapamiento en el schema de la ruta.
export async function reasignarProyecto(proyectoId: string, datos: DatosReasignarProyecto) {
  const { autorIds, ...datosProyecto } = datos;

  // Sin coautoría en este update: un solo UPDATE de proyectos, como
  // antes — no hace falta transacción ni tocar proyectos_autores.
  if (!autorIds) {
    const [fila] = await db.update(proyectos).set(datosProyecto).where(eq(proyectos.id, proyectoId)).returning();
    if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
    return fila;
  }

  const [autorPrincipal] = autorIds;
  // reasignarProyectoSchema ya exige al menos un id cuando autorIds
  // viene en el body (.min(1)) — este guard es solo para que TS sepa
  // que autorPrincipal no es undefined, no una validación de negocio real.
  if (!autorPrincipal) throw new Error('reasignarProyecto necesita al menos un autorId en autorIds');

  return db.transaction(async (tx) => {
    // proyectos.autorId (columna legacy, todavía vigente en la etapa
    // aditiva de la migración a coautoría — ver crearProyecto más
    // arriba) se mantiene sincronizada con el primer autor del array:
    // sigue siendo la fuente que usan el control de acceso del Portal
    // del Autor, riesgo, carga, pagos y seguimiento, que no migraron a
    // proyectos_autores.
    const [fila] = await tx
      .update(proyectos)
      .set({ ...datosProyecto, autorId: autorPrincipal })
      .where(eq(proyectos.id, proyectoId))
      .returning();
    if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);

    // Reemplaza TODAS las filas de coautoría — más simple y menos
    // propenso a errores que calcular un diff (altas/bajas) contra lo
    // que había antes, y el volumen por proyecto es bajo.
    await tx.delete(proyectosAutores).where(eq(proyectosAutores.proyectoId, proyectoId));
    await tx.insert(proyectosAutores).values(autorIds.map((autorId) => ({ proyectoId, autorId })));

    return fila;
  });
}

// Eliminación real (no soft-delete): destruye la fila de proyectos y,
// por cascada de FK (ver server/db/schema/*.ts: fichas_trazabilidad,
// capitulos, pausas, pagos, seguimiento_fases todos referencian
// proyecto_id con onDelete: 'cascade'), TODO el historial operativo y
// financiero asociado — la ficha completa de las 8 fases, capítulos,
// pausas, pagos registrados, registros de seguimiento de jefatura. No
// hay confirmación adicional de este lado (la UI la pide con
// window.confirm) ni papelera de reciclaje: una vez llamado, no hay
// vuelta atrás. undefined si el proyecto no existe (la ruta lo traduce
// a 404).
export async function eliminarProyecto(proyectoId: string) {
  const [fila] = await db.delete(proyectos).where(eq(proyectos.id, proyectoId)).returning();
  return fila;
}

export interface DatosEquipoProyecto {
  especialistaId?: string | null;
  editorId?: string | null;
  correctorId?: string | null;
  disenadorId?: string | null;
  jefeAreaId?: string | null;
}

// "Equipo asignado" (SeccionEquipo.tsx, antes "Escuadrón de Producción"):
// panel único de jefe_area para ver y reasignar las columnas de
// asignación de un proyecto en un solo lugar. No reemplaza las rutas
// puntuales que ya existían (asignarEspecialista, asignarEditor,
// asignarDisenador) — esas siguen siendo el camino de cada flujo propio
// (jefe_area asigna especialista al recibir el proyecto, jefe_edicion
// asigna editor, el especialista dueño asigna disenador); esta es la
// vista consolidada para corregir cualquiera de estos después, sin salir
// del detalle del proyecto. nullable: jefe_area también debe poder dejar
// un rol sin asignar de nuevo, no solo reemplazarlo. calidadId/digitalId/
// lanzamientoId/distribucionId se dieron de baja a pedido explícito del
// negocio (ver el comentario completo en schema/proyectos.ts); jefeAreaId
// es nuevo — son 2 personas reales las que se reparten los proyectos
// entrantes.
export async function actualizarEquipoProyecto(proyectoId: string, datos: DatosEquipoProyecto) {
  const [fila] = await db.update(proyectos).set(datos).where(eq(proyectos.id, proyectoId)).returning();
  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  return fila;
}

// Propuesta de portada — dueño especialista o disenador (PATCH
// /:id/propuesta-portada, verificarAccesoAProyecto ya cubre ambos por su
// columna individual). Resetea la decisión del autor a 'pendiente' y
// limpia cualquier feedback anterior: ese feedback pertenecía a la
// propuesta vieja (normalmente rechazada), no tiene sentido que siga
// colgando junto a una propuesta nueva que el autor todavía no vio. El
// otro lado de este ciclo es actualizarDecisionPortada en
// helpers/portalAutor.ts (dueño autor).
export async function actualizarPropuestaPortada(proyectoId: string, propuestaPortadaUrl: string | null) {
  const [fila] = await db
    .update(proyectos)
    .set({ propuestaPortadaUrl, portadaDecisionAutor: 'pendiente', portadaFeedback: null })
    .where(eq(proyectos.id, proyectoId))
    .returning();
  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  return fila;
}

// Asignar especialista es un paso propio (lo decide jefatura de área),
// separado de la creación del proyecto: jefe_area crea el proyecto y
// luego reparte el trabajo, casi siempre en dos pasos seguidos de la
// misma pantalla, pero nunca es el mismo paso.
// estado: 'en_proceso' es explícito a pedido del negocio ("pasa a
// producción activa al asignar") — hoy es un no-op en la práctica:
// proyectos.estado nace en 'en_proceso' (ver schema/proyectos.ts) y
// ningún otro punto del backend lo cambia todavía (retrasado/stand_by/
// pausado/culminado/retirado no tienen flujo propio implementado aún),
// así que un proyecto sin especialista nunca puede estar en otro
// estado. Se deja igual, en vez de omitirlo, para que el contrato de
// este endpoint sea correcto el día que esos otros flujos existan — sin
// esto, asignar especialista a un proyecto marcado 'pausado' antes de
// tener especialista (caso hoy imposible, no garantizado a futuro) lo
// dejaría con un especialista pero sin volver a 'en_proceso'.
export async function asignarEspecialista(proyectoId: string, especialistaId: string): Promise<void> {
  const [fila] = await db
    .update(proyectos)
    .set({ especialistaId, estado: 'en_proceso' })
    .where(eq(proyectos.id, proyectoId))
    .returning({ id: proyectos.id });

  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
}

// Mismo patrón que asignarEspecialista, pero lo decide jefe_edicion:
// paso propio, separado de la creación del proyecto.
export async function asignarEditor(proyectoId: string, editorId: string): Promise<void> {
  const [fila] = await db.update(proyectos).set({ editorId }).where(eq(proyectos.id, proyectoId)).returning({ id: proyectos.id });

  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
}

// Mismo patrón que asignarEditor, pero lo decide el propio especialista
// dueño del proyecto (no una jefatura): la ruta que la llama verifica
// esa pertenencia con verificarAccesoAProyecto antes de invocarla.
export async function asignarDisenador(proyectoId: string, disenadorId: string): Promise<void> {
  const [fila] = await db.update(proyectos).set({ disenadorId }).where(eq(proyectos.id, proyectoId)).returning({ id: proyectos.id });

  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
}

export interface ProyectoSinEditor {
  id: string;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

// Para la pantalla de jefe_edicion "Proyectos sin editor asignado":
// mismo join autor/servicio que alertas.ts, filtrado a proyectos
// activos sin editorId. No filtra por si ya llegó el manuscrito — ese
// dato no existe todavía en el modelo (limitación conocida: hoy se ven
// acá proyectos que ni siquiera tienen manuscrito aún).
export async function listarProyectosSinEditor(): Promise<ProyectoSinEditor[]> {
  const filas = await db
    .select({
      id: proyectos.id,
      autorId: autores.id,
      autorNombre: autores.nombre,
      servicioId: servicios.id,
      servicioCodigo: servicios.codigo,
      servicioNombre: servicios.nombre,
    })
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(isNull(proyectos.editorId), inArray(proyectos.estado, ESTADOS_ACTIVOS)));

  return filas.map((fila) => ({
    id: fila.id,
    autor: { id: fila.autorId, nombre: fila.autorNombre },
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
  }));
}
export interface ProyectoResumen {
  id: string;
  titulo: string | null;
  codigo: string;
  estado: EstadoProyecto;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

// Distinto de ProyectoResumen a propósito: solo GET /api/proyectos (esta
// función) migró a `autores: []` — GET /api/proyectos/activos
// (listarProyectosActivosResumen, más abajo) sigue devolviendo `autor`
// singular sin tocar, es la etapa aditiva de la migración a coautoría
// (ver proyectos_autores en schema/proyectos.ts y helpers/proyectosAutores.ts).
export interface ProyectoResumenConAutores {
  id: string;
  titulo: string | null;
  codigo: string;
  estado: EstadoProyecto;
  autores: AutorDeProyecto[];
  servicio: { id: string; codigo: string; nombre: string };
}

// TODO (Regla de negocio no confirmada): Si el volumen de proyectos crece
// mucho a lo largo de los años, esta consulta podría necesitar paginación.
// Por ahora trae todos los proyectos ordenados por fecha de creación
// descendente (el más nuevo primero).
export async function listarTodosLosProyectos(): Promise<ProyectoResumenConAutores[]> {
  const filas = await db
    .select({
      id: proyectos.id,
      titulo: proyectos.titulo,
      codigo: proyectos.codigo,
      estado: proyectos.estado,
      servicioId: servicios.id,
      servicioCodigo: servicios.codigo,
      servicioNombre: servicios.nombre,
    })
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .orderBy(desc(proyectos.createdAt));

  // Coautoría: un proyecto puede tener 0 o varios autores en la tabla de
  // unión (0 solo debería pasar en datos viejos que el backfill de la
  // migración no haya cubierto) — una sola consulta en lote en vez de
  // N+1, ver obtenerAutoresPorProyectos.
  const autoresPorProyecto = await obtenerAutoresPorProyectos(filas.map((fila) => fila.id));

  return filas.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    codigo: fila.codigo,
    estado: fila.estado,
    autores: autoresPorProyecto.get(fila.id) ?? [],
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
  }));
}

// Selector de proyectos para el módulo de pagos (RegistrarPagoPage.tsx):
// mismo shape que listarTodosLosProyectos, pero deliberadamente un
// endpoint nuevo y angosto en vez de ensanchar GET /api/proyectos —
// ese queda restringido a jefatura/dirección a propósito (ver su
// comentario en proyectos.routes.ts), así que comercial/rrpp/cobranzas
// necesitan su propia puerta, filtrada además a solo estados activos
// (no tiene sentido registrar un pago sobre un proyecto retirado).
export async function listarProyectosActivosResumen(): Promise<ProyectoResumen[]> {
  const filas = await db
    .select({
      id: proyectos.id,
      titulo: proyectos.titulo,
      codigo: proyectos.codigo,
      estado: proyectos.estado,
      autorId: autores.id,
      autorNombre: autores.nombre,
      servicioId: servicios.id,
      servicioCodigo: servicios.codigo,
      servicioNombre: servicios.nombre,
    })
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(inArray(proyectos.estado, ESTADOS_ACTIVOS))
    .orderBy(desc(proyectos.createdAt));

  return filas.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    codigo: fila.codigo,
    estado: fila.estado,
    autor: { id: fila.autorId, nombre: fila.autorNombre },
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
  }));
}