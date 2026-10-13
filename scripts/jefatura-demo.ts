/** Escenarios solicitados por el usuario: solo agrega registros DEMO locales. */
import 'dotenv/config';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import {
  autores,
  users,
  servicios,
  unidades,
  presupuestos,
  proyectos,
  fichasTrazabilidad,
  correcciones,
  decisiones,
  fichaCalidadFases,
  projectAssignments,
  workItems,
} from '../server/db/schema/index.js';
import { hashPassword } from '../server/helpers/password.js';
import {
  crearProyecto,
  notificarRrppProyectoBase,
  notificarJefaturaFichaCompletada,
  asignarEspecialista,
  actualizarProyecto,
  asignarEditor,
  actualizarEquipoProyecto,
} from '../server/helpers/proyectos.js';
import {
  obtenerDashboardJefatura,
  decidirExpressJefatura,
} from '../server/helpers/jefatura.js';
import {
  solicitarCorreccion,
  asignarCorrector,
  marcarInicioCorreccion,
  registrarEntregaCorreccion,
  cerrarCorreccion,
} from '../server/helpers/correcciones.js';
import { calcularDueAtCorreccion } from '../server/helpers/correccionSla.js';
import {
  iniciarRevision,
  solicitarInformacion,
  responderInformacion,
  resolverDecision,
} from '../server/helpers/decisiones.js';
import { crearPausa } from '../server/helpers/pausas.js';
import {
  crearWorkItemSiNoExiste,
  transicionarWorkItemPorId,
} from '../server/helpers/workItems.js';
import {
  crearCapitulo,
  actualizarCapituloAutor,
  actualizarCapituloEditor,
} from '../server/helpers/capitulos.js';
import { registrarEvento } from '../server/helpers/auditLog.js';
import {
  solicitarDireccionCreativa,
  asignarLiderCreativo,
  registrarReunionCreativa,
  registrarBrief,
  registrarBriefAutor,
  agregarConceptoPortada,
  aprobarConceptoRrpp,
  registrarConceptoAutor,
  registrarRecursosCreativos,
  cerrarDireccionCreativa,
} from '../server/helpers/direccionCreativa.js';
import {
  solicitarDiseno,
  asignarDiseno,
  entregarDiseno,
  coordinarVersion,
} from '../server/helpers/diseno.js';
import {
  iniciarCalidad,
  resolverCalidad,
  criteriosDeFase,
  coordinarCalidad,
  escalarColeccionInconsistente,
} from '../server/helpers/calidad.js';
import {
  guardarSupervision,
  obtenerIntervencion,
} from '../server/helpers/seguimientoIntervenciones.js';

const target = new URL(env.DATABASE_URL);
if (
  env.NODE_ENV !== 'development' ||
  !['localhost', '127.0.0.1'].includes(target.hostname) ||
  target.pathname !== '/panhouse'
)
  throw new Error('Este script solo admite Panhouse local de desarrollo');
const hoy = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const dia = (offset: number) =>
  new Date(`${hoy}T12:00:00Z`).getTime() + offset * 86400000;
const fecha = (offset: number) =>
  new Date(dia(offset)).toISOString().slice(0, 10);
const enlace = (nombre: string) =>
  `https://example.com/panhouse-demo/${nombre}`;
function asegurar<T extends { ok: boolean; error?: string }>(r: T): T {
  if (!r.ok) throw new Error(r.error ?? 'No se completó el movimiento');
  return r;
}
const personas = await db.select().from(users);
function actor(rol: typeof users.$inferInsert.rol, email?: string) {
  const u = personas.find(
    (u) => u.rol === rol && u.activo && (!email || u.email === email),
  );
  if (!u) throw new Error(`Falta actor activo ${rol}`);
  return { id: u.id, rol: u.rol, nombre: u.nombre };
}
const jefa = actor('jefe_area', 'jefatura.demo@panhouse.test'),
  rrpp = actor('rrpp'),
  comercial = actor('comercial'),
  editor = actor('editor'),
  jefeEdicion = actor('jefe_edicion'),
  creativo = actor('lider_creativo'),
  disenador = actor('disenador'),
  soporte = actor('soporte_editorial');
const especialistas = personas
  .filter((u) => u.rol === 'especialista' && u.activo)
  .sort((a, b) => a.nombre.localeCompare(b.nombre));
if (especialistas.length < 3)
  throw new Error('Se requieren al menos tres especialistas');
const catalogo = await db
  .select()
  .from(servicios)
  .where(eq(servicios.activo, true));
const serviciosDemo = ['EF', 'CR', 'SE'].map((c) => {
  const s = catalogo.find((s) => s.codigo === c);
  if (!s) throw new Error(`Falta servicio ${c}`);
  return s;
});
const unidad = (await db.select().from(unidades).limit(1))[0]!,
  presupuesto = (await db.select().from(presupuestos).limit(1))[0]!;
if (!unidad || !presupuesto) throw new Error('Faltan catálogos');
if (
  (
    await pool.query(
      "SELECT 1 FROM autores WHERE nombre LIKE 'DEMO JEF · %' LIMIT 1",
    )
  ).rowCount
)
  throw new Error('Los escenarios DEMO JEF ya existen; no se duplican');
const originales = (
  await pool.query('SELECT id,to_jsonb(p) datos FROM proyectos p ORDER BY id')
).rows;
const firma = (rows: unknown[]) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const firmaOriginal = firma(originales),
  idsOriginales = originales.map((p) => p.id);
const nuevosAutores: string[] = [],
  nuevosUsuarios: string[] = [],
  propios = new Set<string>();
const casos: {
  id: string;
  codigo: string;
  nombre: string;
  escenario: string;
}[] = [];
await mkdir('docs/demo', { recursive: true });
async function corrector(nombre: string, email: string) {
  const existing = personas.find((u) => u.email === email);
  if (existing) {
    if (existing.rol !== 'corrector' || !existing.activo)
      throw new Error('Corrector demo incompatible');
    return existing;
  }
  const [u] = await db
    .insert(users)
    .values({
      nombre,
      email,
      rol: 'corrector',
      passwordHash: await hashPassword(randomBytes(24).toString('base64url')),
    })
    .returning();
  nuevosUsuarios.push(u!.id);
  return u!;
}
async function nota(
  origen: 'correccion' | 'calidad',
  id: string,
  texto: string,
  datos: Record<string, unknown> = {},
) {
  const actual = await obtenerIntervencion(origen, id);
  if (!actual) throw new Error('No se pudo proyectar la intervención');
  await guardarSupervision(
    origen,
    id,
    {
      observaciones: `DEMO · ${texto}`,
      expectedUpdatedAt: actual.updatedAt,
      ...datos,
    },
    jefa.id,
  );
}
async function tiempoDemostracion(
  id: string,
  proyectoId: string,
  alcance: 'tripa_completa' | 'preliminares' | 'cubierta_extendida',
  diasAntes: number,
) {
  if (!propios.has(proyectoId))
    throw new Error(
      'Solo se pueden ajustar los tiempos de proyectos creados por este script',
    );
  const recibido = new Date(Date.now() - diasAntes * 86400000),
    iniciado = new Date(recibido.getTime() + 3600000);
  await db
    .update(correcciones)
    .set({
      asignadoEn: recibido,
      fechaAsignada: recibido.toISOString().slice(0, 10),
      iniciadoEn: iniciado,
      fechaInicio: iniciado.toISOString().slice(0, 10),
      dueAt: new Date(calcularDueAtCorreccion(recibido.toISOString(), alcance)),
    })
    .where(eq(correcciones.id, id));
  await db
    .update(projectAssignments)
    .set({ asignadoEn: recibido })
    .where(
      and(
        eq(projectAssignments.proyectoId, proyectoId),
        eq(projectAssignments.tipo, 'corrector'),
        isNull(projectAssignments.finalizadoEn),
      ),
    );
  // Historia ficticia marcada DEMO; el SLA mantiene la fórmula central del alcance.
}
async function tripaEntregada(
  proyectoId: string,
  spec: { id: string },
  correctorId: string,
) {
  const c = await solicitarCorreccion(
    proyectoId,
    { alcance: 'tripa_completa', paginas: 98 },
    spec.id,
  );
  asegurar(
    await asignarCorrector(
      c.id,
      { correctorId, freelance: false, contratoConfirmado: true },
      spec.id,
    ),
  );
  await marcarInicioCorreccion(c.id, undefined, correctorId);
  await registrarEntregaCorreccion(
    c.id,
    {
      controlCambiosUrl: enlace('tripa-corregida'),
      informeTecnicoUrl: enlace('informe-correccion'),
      motivo: 'DEMO · Entrega para continuar el proceso',
    },
    correctorId,
  );
  await cerrarCorreccion(
    c.id,
    {
      resultado: 'buena',
      observaciones: 'DEMO · Tripa revisada y lista para diseño',
    },
    spec.id,
  );
  return c.id;
}
async function calidad(
  proyectoId: string,
  spec: { id: string; rol: 'especialista' },
  indice: number,
  correctorId: string,
) {
  const correccionId = await tripaEntregada(proyectoId, spec, correctorId);
  await db
    .update(proyectos)
    .set({ fechaFeedbackTripa: hoy })
    .where(eq(proyectos.id, proyectoId));
  const dc = asegurar(await solicitarDireccionCreativa(proyectoId, spec.id));
  if (!dc.id) throw new Error('No se creó Creativa');
  asegurar(await asignarLiderCreativo(dc.id, creativo.id, jefa.id));
  await registrarReunionCreativa(
    dc.id,
    { fecha: hoy, realizada: true, enlaceGrabacion: enlace('reunion') },
    creativo.id,
  );
  await registrarBrief(
    dc.id,
    { briefEnlace: enlace('brief'), fechaBriefEnviadoEspecialista: hoy },
    creativo.id,
  );
  await registrarBriefAutor(
    dc.id,
    { fechaBriefEnviadoAutor: hoy, fechaBriefAprobadoAutor: hoy },
    spec.id,
  );
  const concepto = asegurar(
    await agregarConceptoPortada(
      dc.id,
      {
        descripcion: 'DEMO · Concepto editorial aprobado',
        enlace: enlace('concepto'),
      },
      creativo.id,
    ),
  );
  asegurar(await aprobarConceptoRrpp(concepto.id!, { aprobar: true }, rrpp.id));
  asegurar(
    await registrarConceptoAutor(
      concepto.id!,
      {
        fechaEnviadaAutor: hoy,
        fechaAprobadaAutor: hoy,
        estado: 'Aprobada por autor',
      },
      spec.id,
    ),
  );
  asegurar(
    await registrarRecursosCreativos(
      dc.id,
      {
        recursoImagenUrl: enlace('imagen'),
        recursoConceptoPdfUrl: enlace('concepto.pdf'),
      },
      creativo.id,
    ),
  );
  await cerrarDireccionCreativa(
    dc.id,
    {
      resultadoFinal: 'aprobado',
      observaciones: 'DEMO · Recursos disponibles',
    },
    spec.id,
  );
  await actualizarEquipoProyecto(proyectoId, { disenadorId: disenador.id });
  const muestra = await solicitarDiseno(
    proyectoId,
    {
      tipo: 'muestra_diagramacion',
      solicitudKey: randomUUID(),
      fuenteUrl: enlace('fuente-muestra'),
      capitulosMuestra: 3,
      preparacionConfirmada: true,
    },
    spec,
  );
  const muestraV = await entregarDiseno(
    muestra.id,
    { enlace: enlace('muestra-v1'), entregaKey: randomUUID() },
    disenador,
  );
  await coordinarVersion(
    muestra.id,
    muestraV.id,
    { accion: 'enviar_autor' },
    spec,
  );
  await coordinarVersion(
    muestra.id,
    muestraV.id,
    { accion: 'aprobar_autor' },
    spec,
  );
  const d = await solicitarDiseno(
    proyectoId,
    {
      tipo: 'diagramacion',
      solicitudKey: randomUUID(),
      fuenteUrl: enlace('tripa-word'),
      correccionId,
      aprobacionEdicionUrl: enlace('aprobacion-edicion'),
      preparacionConfirmada: true,
    },
    spec,
  );
  const v = await entregarDiseno(
    d.id,
    { enlace: enlace('tripa-diagramada-v1'), entregaKey: randomUUID() },
    disenador,
  );
  await coordinarVersion(d.id, v.id, { accion: 'handoff_calidad' }, spec);
  let q = (
    await db
      .select()
      .from(fichaCalidadFases)
      .where(eq(fichaCalidadFases.disenoVersionId, v.id))
  )[0]!;
  if (indice === 0) {
    await nota('calidad', q.id, 'Pendiente de recepción en Fase de Calidad 1');
    return;
  }
  await iniciarCalidad(
    q.id,
    new Date(Date.now() + (indice === 1 ? -2 : 24) * 3600000).toISOString(),
    soporte,
  );
  if (indice === 1) {
    await nota(
      'calidad',
      q.id,
      'Revisión en curso con plazo vencido; priorizar seguimiento',
    );
    return;
  }
  if (indice === 2) {
    await escalarColeccionInconsistente(
      q.id,
      'DEMO · La propuesta menciona una colección diferente; verificar la clasificación antes de continuar.',
      soporte,
    );
    return;
  }
  const checklist = Object.fromEntries(
    criteriosDeFase(1).map((k) => [k, { cumple: true }]),
  );
  await resolverCalidad(
    q.id,
    {
      aprobar: indice !== 3,
      cantidadComentarios: indice === 3 ? 7 : 0,
      cantidadPaginas: 98,
      checklist,
      ...(indice === 3
        ? {
            comentariosUrl: enlace('comentarios-f1'),
            observaciones: 'DEMO · Ajustar siete detalles de estilo',
          }
        : { observaciones: 'DEMO · Revisión de F1 aprobada' }),
    },
    soporte,
  );
  await nota(
    'calidad',
    q.id,
    indice === 3
      ? 'Devuelto a Diseño con siete comentarios'
      : 'F1 aprobada; continúa coordinación',
    { resultadoSeguimiento: indice === 3 ? 'regular' : 'buena' },
  );
  if (indice === 3) {
    const v2 = await entregarDiseno(
      d.id,
      { enlace: enlace('tripa-diagramada-v2'), entregaKey: randomUUID() },
      disenador,
    );
    await coordinarVersion(d.id, v2.id, { accion: 'handoff_calidad' }, spec);
    q = (
      await db
        .select()
        .from(fichaCalidadFases)
        .where(eq(fichaCalidadFases.disenoVersionId, v2.id))
    )[0]!;
    await iniciarCalidad(
      q.id,
      new Date(Date.now() + 36 * 3600000).toISOString(),
      soporte,
    );
    await nota(
      'calidad',
      q.id,
      'Validación de V2 en curso; verificar comentarios aplicados',
    );
    return;
  }
  await coordinarCalidad(
    q.id,
    {
      accion: 'enviar_autor',
      feedbackAutorDueAt: new Date(Date.now() + 72 * 3600000).toISOString(),
    },
    spec,
  );
  if (indice === 4) {
    await nota(
      'calidad',
      q.id,
      'Aprobado por Soporte; esperando respuesta del autor',
    );
    return;
  }
  await coordinarCalidad(q.id, { accion: 'aprobar_autor' }, spec);
  await coordinarCalidad(
    q.id,
    { accion: 'revision_final', numerosLegalesUrl: enlace('numeros-legales') },
    spec,
  );
  const final = (
    await db
      .select()
      .from(fichaCalidadFases)
      .where(
        and(
          eq(fichaCalidadFases.disenoVersionId, v.id),
          eq(fichaCalidadFases.numeroFase, 3),
        ),
      )
  )[0]!;
  await iniciarCalidad(
    final.id,
    new Date(Date.now() + 48 * 3600000).toISOString(),
    soporte,
  );
  await escalarColeccionInconsistente(
    final.id,
    'DEMO · Revisión final: confirmar si la colección indicada coincide con la identidad editorial de la obra.',
    soporte,
  );
  await nota(
    'calidad',
    final.id,
    'Revisión final en curso; consulta de colección abierta',
  );
}
const nombres = [
  'Marina Solís',
  'Tomás Méndez',
  'Lucía Rojas',
  'Samuel Vargas',
  'Daniela Acosta',
  'Sofía Cabrera',
  'Andrés Herrera',
  'Valeria Ríos',
  'Javier Molina',
  'Paula Benítez',
  'Elisa Vega',
  'Gabriel Silva',
];
const titulos = [
  'La brújula del viento',
  'Las voces del jardín',
  'El mapa interior',
  'Cuadernos del sur',
  'El último puerto',
  'Los días azules',
  'Memorias de agua',
  'La estación de las luces',
  'El hilo de la memoria',
  'El atlas del tiempo',
  'La casa del horizonte',
  'Paisajes del recuerdo',
];
try {
  const correctores = [
    await corrector(
      'Correctora Demo · Alicia',
      'correctora.alicia.demo@panhouse.test',
    ),
    await corrector(
      'Corrector Demo · Bruno',
      'corrector.bruno.demo@panhouse.test',
    ),
  ];
  for (let i = 0; i < 60; i++) {
    const [autor] = await db
      .insert(autores)
      .values({
        nombre: `DEMO JEF · ${nombres[i % nombres.length]} ${String(i + 1).padStart(2, '0')}`,
        email: [`autor.jef.demo.${i + 1}@panhouse.test`],
      })
      .returning();
    nuevosAutores.push(autor!.id);
    const s = serviciosDemo[i % serviciosDemo.length]!;
    const creado = asegurar(
      await crearProyecto({
        autorIds: [autor!.id],
        servicioId: s.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        fechaProgramadaInicio: fecha(i >= 50 && i <= 52 ? -230 : -10),
        ...(i % 5 === 0 ? { fechaDeseadaAutor: fecha(25) } : {}),
      }),
    );
    if (!creado.ok) throw new Error('No se creó el proyecto');
    const p = creado.proyecto;
    propios.add(p.id);
    const nombre = `DEMO · ${titulos[i % titulos.length]} ${i + 1}`;
    await db
      .update(proyectos)
      .set({
        tituloDefinitivo: nombre,
        subtituloDefinitivo: 'Escenario de demostración de Jefatura',
        jefeAreaId: jefa.id,
      })
      .where(eq(proyectos.id, p.id));
    await db
      .update(fichasTrazabilidad)
      .set({
        ingresoFechaIngreso: hoy,
        ingresoServicioEjecucion: 'Normal',
        ingresoServicioAlianza: false,
        capitulosPactados: '10',
        paginasPactadas: '100',
        posibleTituloLibro: nombre,
      })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    asegurar(await notificarRrppProyectoBase(p.id, comercial.id));
    await db
      .update(fichasTrazabilidad)
      .set({
        matrizDiagnosticoGenerado: true,
        matrizIngresoGenerado: true,
        ingresoServicioSubtipoCrudo:
          s.codigo === 'CR' ? (i % 2 ? 'Tripa' : 'Capítulo') : null,
      })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    asegurar(await notificarJefaturaFichaCompletada(p.id, rrpp.id));
    let spec = especialistas[i % especialistas.length]!;
    let escenario = 'Por asignar';
    if (i >= 8) {
      await asignarEspecialista(p.id, spec.id, jefa.id);
      escenario = 'Asignado, listo para iniciar';
    }
    if ([10, 12, 17, 23].includes(i)) {
      spec = especialistas[(i + 2) % especialistas.length]!;
      await asignarEspecialista(p.id, spec.id, jefa.id);
      escenario = 'Reasignado a otro especialista';
    }
    if (i % 5 === 0 && i < 53) {
      const ex = (await obtenerDashboardJefatura()).proyectos.find(
        (x) => x.id === p.id,
      )?.express;
      if (ex?.estado === 'posible' && i % 10 === 0)
        asegurar(
          await decidirExpressJefatura(p.id, jefa.id, {
            decision: 'confirmado',
            fechaDeseada: ex.fechaDeseada!,
            fechaEstandar: ex.fechaEstandar!,
            motivo: 'DEMO · Compromiso Express revisado por Jefatura',
          }),
        );
    }
    if (i >= 14 && i <= 19) {
      await asignarEditor(p.id, editor.id, jefeEdicion.id);
      const wi = await db.transaction((tx) =>
        crearWorkItemSiNoExiste(tx, {
          proyectoId: p.id,
          tipo: 'edicion',
          observaciones: 'DEMO · Edición por capítulos',
        }),
      );
      await db.transaction((tx) =>
        transicionarWorkItemPorId(
          tx,
          wi,
          i === 19 ? 'bloqueado' : 'en_progreso',
        ),
      );
      for (let n = 1; n <= 5; n++) {
        await crearCapitulo(p.id, n);
        if (n <= ((i - 13) % 5) + 1) {
          await actualizarCapituloEditor(p.id, n, {
            fechaInicioEditor: fecha(-6),
            paginas: 12 + n,
            ...(n < 3 ? { fechaEntregaEditor: fecha(-3) } : {}),
          });
          if (n < 3)
            await actualizarCapituloAutor(
              p.id,
              n,
              {
                fechaEnvioAutor: fecha(-3),
                enlaces: [enlace(`capitulo-${n}`)],
                ...(n === 1 ? { fechaRespuestaReal: fecha(-1) } : {}),
              },
              spec.id,
            );
        }
      }
      escenario =
        i === 19
          ? 'Edición bloqueada por respuesta pendiente'
          : 'Edición a mitad; capítulos en diferentes etapas';
    }
    if (i >= 20 && i <= 25) {
      const step = i - 20,
        alcance =
          step === 3
            ? 'preliminares'
            : step === 1
              ? 'cubierta_extendida'
              : 'tripa_completa';
      const c = await solicitarCorreccion(
        p.id,
        { alcance, paginas: 98 },
        spec.id,
      );
      if (step > 0)
        asegurar(
          await asignarCorrector(
            c.id,
            {
              ...(step === 4
                ? { correctorNombre: 'DEMO · Andrea Díaz (freelance)' }
                : { correctorId: correctores[step % 2]!.id }),
              freelance: step === 4,
              contratoConfirmado: true,
            },
            spec.id,
          ),
        );
      if (step > 1)
        await marcarInicioCorreccion(
          c.id,
          undefined,
          step === 4 ? spec.id : correctores[step % 2]!.id,
        );
      if (step === 3 || step === 5)
        await tiempoDemostracion(c.id, p.id, alcance, step === 5 ? 7 : 3);
      if (step >= 4) {
        await registrarEntregaCorreccion(
          c.id,
          {
            controlCambiosUrl: enlace('control-cambios'),
            informeTecnicoUrl: enlace('informe-tecnico'),
            motivo: 'DEMO · Entrega de corrección',
          },
          step === 4 ? spec.id : correctores[step % 2]!.id,
        );
        if (step === 5)
          await cerrarCorreccion(
            c.id,
            {
              resultado: 'regular',
              observaciones:
                'DEMO · Entregado fuera de plazo; reforzar seguimiento',
            },
            spec.id,
          );
      }
      escenario = [
        'Corrección solicitada, sin corrector',
        'Corrector asignado, por iniciar',
        'Corrección en curso',
        'Corrección vencida, en curso',
        'Freelance entregado, evaluación pendiente',
        'Corrección cerrada y evaluada',
      ][step]!;
      await nota(
        'correccion',
        c.id,
        escenario,
        step === 4
          ? { pago80: true, pago20: false, cantidadComentarios: 9 }
          : step === 5
            ? { cantidadComentarios: 14 }
            : {},
      );
    }
    if (i >= 26 && i <= 31) {
      await calidad(
        p.id,
        { id: spec.id, rol: 'especialista' },
        i - 26,
        correctores[i % 2]!.id,
      );
      escenario = [
        'Calidad F1 pendiente',
        'Calidad F1 en curso y vencida',
        'Calidad F1 con decisión de colección pendiente',
        'Validación V2 en progreso',
        'Calidad aprobada, esperando autor',
        'Revisión final con consulta de colección',
      ][i - 26]!;
    }
    if (i >= 32 && i <= 43) {
      const step = (i - 32) % 6,
        c = await solicitarCorreccion(
          p.id,
          { alcance: 'tripa_completa', paginas: 146 + (i - 32) * 7 },
          spec.id,
        );
      const decision = (
        await db
          .select()
          .from(decisiones)
          .where(eq(decisiones.originCorreccionId, c.id))
      )[0]!;
      if (step > 0) asegurar(await iniciarRevision(decision.id, jefa));
      if (step === 2 || step === 3)
        asegurar(
          await solicitarInformacion(
            decision.id,
            jefa,
            'DEMO · Adjuntar diagnóstico y confirmar la extensión final de la tripa.',
          ),
        );
      if (step === 3)
        asegurar(
          await responderInformacion(
            decision.id,
            { id: spec.id, rol: 'especialista' },
            'DEMO · Diagnóstico aportado. La extensión incluye preliminares y capítulos revisados.',
          ),
        );
      if (step >= 4) {
        asegurar(
          await resolverDecision(
            decision.id,
            jefa,
            step === 4 ? 'approved' : 'rejected',
            step === 4
              ? 'DEMO · Revisión previa favorable; se autoriza asignar corrector.'
              : 'DEMO · Ajustar estructura y volver a presentar la tripa antes de corregir.',
            undefined,
          ),
        );
        if (step === 4) {
          asegurar(
            await asignarCorrector(
              c.id,
              {
                correctorId: correctores[i % 2]!.id,
                freelance: false,
                contratoConfirmado: true,
              },
              spec.id,
            ),
          );
          await marcarInicioCorreccion(c.id, undefined, correctores[i % 2]!.id);
        }
      }
      escenario = [
        'Decisión pendiente, gate bloqueado',
        'Decisión en revisión',
        'Decisión esperando información',
        'Información respondida, revisión a mitad',
        'Decisión aprobada y corrección iniciada',
        'Decisión rechazada con motivo',
      ][step]!;
      await nota('correccion', c.id, escenario);
    }
    if (i >= 44 && i <= 46) {
      await crearPausa({
        proyectoId: p.id,
        causa: 'autor',
        fechaInicio: new Date(),
        esPausadoFormal: true,
        fechaLimiteRetoma: fecha(30),
        pagoConfirmado: true,
        origenConfirmacionPago: 'manual',
        confirmadoPagoPorId: jefa.id,
        confirmadoPagoEn: new Date(),
      });
      // Estado de fixture respaldado por pausa formal y atestación DEMO, sin pagos reales.
      await db.transaction(async (tx) => {
        await tx
          .update(proyectos)
          .set({ estado: 'pausado' })
          .where(eq(proyectos.id, p.id));
        await registrarEvento(tx, {
          actorId: jefa.id,
          accion: 'PROYECTO_ESTADO_CAMBIADO',
          entityType: 'proyecto',
          entityId: p.id,
          proyectoId: p.id,
          detalles: {
            anterior: 'en_proceso',
            nuevo: 'pausado',
            especialistaId: spec.id,
            demo: true,
          },
        });
      });
      escenario = 'Pausa formal por autor; retoma pendiente';
    }
    if (i >= 47 && i <= 49) {
      await actualizarProyecto(
        p.id,
        {
          estado: 'stand_by',
          categoriaStandBy: i % 2 ? 'retorno_breve' : 'exoneracion_contractual',
        },
        { id: spec.id, rol: 'especialista' },
      );
      escenario = 'Stand-by, conserva carga asignada';
    }
    if (i >= 50 && i <= 52) {
      await actualizarProyecto(
        p.id,
        { estado: 'retrasado' },
        { id: spec.id, rol: 'especialista' },
      );
      await crearPausa({
        proyectoId: p.id,
        causa: 'otro_departamento',
        fechaInicio: new Date(dia(-5)),
        fechaFin: new Date(dia(-3)),
      });
      escenario = 'Retrasado, seguimiento de plazo y dependencia';
    }
    if (i >= 53 && i <= 57) {
      await tripaEntregada(p.id, spec, correctores[i % 2]!.id);
      await actualizarProyecto(
        p.id,
        { estado: 'culminado' },
        { id: spec.id, rol: 'especialista' },
      );
      escenario = 'Culminado con cierre registrado';
    }
    if (i >= 58) {
      await actualizarProyecto(
        p.id,
        { estado: 'retirado' },
        { id: spec.id, rol: 'especialista' },
      );
      escenario = 'Retirado, fuera de carga activa';
    }
    casos.push({ id: p.id, codigo: p.codigo, nombre, escenario });
    console.log(`${i + 1}/60 · ${p.codigo} · ${escenario}`);
  }
  const despues = (
    await pool.query(
      'SELECT id,to_jsonb(p) datos FROM proyectos p WHERE id=ANY($1::uuid[]) ORDER BY id',
      [idsOriginales],
    )
  ).rows;
  if (firma(despues) !== firmaOriginal)
    throw new Error('La verificación detectó cambios en proyectos originales');
  const summary = {
    creadoEn: new Date().toISOString(),
    base: 'panhouse local',
    demo: true,
    proyectosNuevos: casos.length,
    proyectosOriginales: originales.length,
    originalesConservados: true,
    casos,
  };
  await writeFile(
    'docs/demo/jefatura-escenarios.json',
    JSON.stringify(summary, null, 2) + '\n',
  );
  console.log(
    'DEMO completado: 60 proyectos nuevos; los proyectos originales permanecen intactos.',
  );
} catch (error) {
  // Solo se revierte el conjunto creado por esta ejecución; nunca datos preexistentes.
  if (propios.size)
    await db.delete(proyectos).where(inArray(proyectos.id, [...propios]));
  if (nuevosAutores.length)
    await db.delete(autores).where(inArray(autores.id, nuevosAutores));
  if (nuevosUsuarios.length)
    await db.delete(users).where(inArray(users.id, nuevosUsuarios));
  throw error;
} finally {
  await pool.end();
}
