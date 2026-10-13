/** Datos ficticios locales solicitados: guardado parcial, envíos y trabajo operativo. */
import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { and, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import {
  autores, users, servicios, unidades, presupuestos, proyectos,
  fichasTrazabilidad, decisiones, projectAssignments, workItems,
} from '../server/db/schema/index.js';
import { hashPassword } from '../server/helpers/password.js';
import {
  crearProyecto, notificarRrppProyectoBase, notificarJefaturaFichaCompletada,
  asignarEspecialista, solicitarEditor, asignarEditor, registrarFeedbackTripa,
  asignarDisenador, actualizarProyecto,
} from '../server/helpers/proyectos.js';
import {
  actualizarSeccionProyectoPerfil, actualizarSeccionProyectoContrato,
  actualizarSeccionFichaEditorial, actualizarSeccionMatrizIngreso,
} from '../server/helpers/trazabilidad.js';
import { crearCapitulo, actualizarCapituloAutor, actualizarCapituloEditor } from '../server/helpers/capitulos.js';
import { asignarConHistorial } from '../server/helpers/assignments.js';
import {
  solicitarCorreccion, asignarCorrector, marcarInicioCorreccion,
  registrarEntregaCorreccion, cerrarCorreccion,
} from '../server/helpers/correcciones.js';
import { iniciarRevision, solicitarInformacion, responderInformacion, resolverDecision } from '../server/helpers/decisiones.js';
import {
  solicitarDireccionCreativa, asignarLiderCreativo, registrarReunionCreativa,
  registrarBrief, registrarBriefAutor,
} from '../server/helpers/direccionCreativa.js';
import {
  asignarResponsableLanzamiento, actualizarPlanificacion, registrarReunionLanzamiento,
  guardarEventoRrpp, guardarPublicacionRrpp, planLanzamientoSchema,
  reunionLanzamientoSchema, eventoRrppSchema, publicacionRrppSchema,
} from '../server/helpers/rrppLanzamientos.js';
import { evaluarPreparacionComercial } from '../server/helpers/preparacionComercial.js';
import { evaluarPreparacionRrpp } from '../server/helpers/preparacionRrpp.js';

const target = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/panhouse') {
  throw new Error('Este generador solo admite la base Panhouse local de desarrollo.');
}
const PREFIX = 'DEMO VARIOS · ';
const hoy = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const fecha = (offset: number) => new Date(`${hoy}T12:00:00Z`).getTime() + offset * 86400000;
const dia = (offset: number) => new Date(fecha(offset)).toISOString().slice(0, 10);
const enlace = (n: string) => `https://example.com/panhouse-demo/${n}`;
function asegurar<T extends { ok: boolean; error?: string }>(r: T): T {
  if (!r.ok) throw new Error(r.error ?? 'No se pudo completar la operación DEMO');
  return r;
}
const grupos = [
  'Comercial: ficha a mitad', 'Comercial: listo para enviar',
  'RRPP: recibido, por iniciar', 'RRPP: diagnóstico a mitad',
  'RRPP: listo para Jefatura', 'Jefatura: recibido, por asignar',
  'Especialista: asignado, inicio pendiente', 'Especialista: capítulos a mitad',
  'Especialista y Jefatura: solicitudes y decisiones', 'Especialista y RRPP: entregas y lanzamiento',
];
const nombres = ['Marina Solís', 'Tomás Méndez', 'Lucía Rojas', 'Samuel Vargas', 'Daniela Acosta', 'Sofía Cabrera', 'Andrés Herrera', 'Valeria Ríos', 'Javier Molina', 'Paula Benítez', 'Elisa Vega', 'Gabriel Silva', 'Camila Duarte', 'Diego Paredes', 'Isabel Medina', 'Mateo Suárez'];
const titulos = ['La brújula del viento', 'Las voces del jardín', 'El mapa interior', 'Cuadernos del sur', 'El último puerto', 'Los días azules', 'Memorias de agua', 'La estación de las luces'];
const ubicaciones = [
  { pais: 'Venezuela', ciudad: 'Caracas' }, { pais: 'Colombia', ciudad: 'Bogotá' },
  { pais: 'México', ciudad: 'Ciudad de México' }, { pais: 'Panamá', ciudad: 'Ciudad de Panamá' },
  { pais: 'Argentina', ciudad: 'Buenos Aires' }, { pais: 'España', ciudad: 'Madrid' },
];
const casos: { id: string; codigo: string; autor: string; servicio: string; escenario: string; especialista: string | null }[] = [];
const autorIds: string[] = [];
const userIds: string[] = [];
const originales = new Map<string, { id: string; datos: unknown }[]>();
const firma = (rows: unknown[]) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const lock = await pool.connect();
let rollback = true;
try {
  const locked = await lock.query('SELECT pg_try_advisory_lock(130102026) AS ok');
  if (!locked.rows[0]?.ok) throw new Error('Ya hay una generación DEMO en curso.');
  if ((await pool.query('SELECT 1 FROM autores WHERE nombre LIKE $1 LIMIT 1', [`${PREFIX}%`])).rowCount) {
    console.log('Estos datos DEMO ya existen. No se duplicaron registros.');
    rollback = false;
  } else {
    for (const tabla of ['proyectos', 'autores', 'fichas_trazabilidad', 'work_items', 'project_assignments', 'capitulos', 'decisiones', 'correcciones', 'audit_logs', 'notificaciones']) {
      originales.set(tabla, (await pool.query(`SELECT id, to_jsonb(t) AS datos FROM ${tabla} t ORDER BY id`)).rows);
    }
    const personas = await db.select().from(users).where(eq(users.activo, true));
    function actor(rol: typeof users.$inferSelect.rol) {
      const p = personas.find(p => p.rol === rol && p.email.endsWith('.demo@panhouse.test')) ?? personas.find(p => p.rol === rol);
      if (!p) throw new Error(`Falta usuario activo: ${rol}`);
      return p;
    }
    const comercial = actor('comercial'), rrpp = actor('rrpp'), jefa = actor('jefe_area');
    const specDemo = personas.find(p => p.email === 'especialista.demo@panhouse.test');
    const equipo = personas.filter(p => p.rol === 'especialista');
    if (!specDemo || equipo.length < 2) throw new Error('Faltan Especialistas para distribuir los proyectos.');
    const editor = actor('editor'), jefeEdicion = actor('jefe_edicion');
    const creativo = actor('lider_creativo'), disenador = actor('disenador');
    const catalogo = await db.select().from(servicios).where(eq(servicios.activo, true));
    const catsUnidad = await db.select().from(unidades);
    const catsPresupuesto = await db.select().from(presupuestos);
    if (!catsUnidad.length || !catsPresupuesto.length) throw new Error('Faltan catálogos base.');
    const unidad = catsUnidad.find(u => u.nombre === 'PanHouse') ?? catsUnidad[0]!;
    let corrector = personas.find(p => p.email === 'corrector.varios.demo@panhouse.test');
    if (!corrector) {
      [corrector] = await db.insert(users).values({
        nombre: 'Corrector DEMO · Nicolás', email: 'corrector.varios.demo@panhouse.test', rol: 'corrector',
        passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
      }).returning();
      userIds.push(corrector!.id);
    }
    if (corrector!.rol !== 'corrector') throw new Error('El corrector DEMO tiene un rol incompatible.');

    for (let i = 0; i < 80; i++) {
      const grupo = Math.floor(i / 8), local = i % 8;
      const servicioCodigo = grupo === 7 || grupo === 8 ? (local % 2 ? 'CR' : 'EF') : ['EF', 'CR', 'SE'][i % 3]!;
      const servicio = catalogo.find(s => s.codigo === servicioCodigo);
      if (!servicio) throw new Error(`Falta servicio ${servicioCodigo}`);
      const lugar = ubicaciones[i % ubicaciones.length]!;
      const presupuesto = catsPresupuesto[i % catsPresupuesto.length]!;
      const nombre = `${PREFIX}${nombres[i % nombres.length]} ${String(i + 1).padStart(2, '0')}`;
      const titulo = `${titulos[i % titulos.length]} · DEMO ${i + 1}`;
      const [autor] = await db.insert(autores).values({
        nombre, nombreArtistico: `DEMO ${nombres[i % nombres.length]}`,
        email: [`autor.varios.demo.${i + 1}@panhouse.test`], pais: lugar.pais,
        nacionalidad: [lugar.pais], fechaNacimiento: `${1970 + i % 30}-04-12`,
        ocupacion: ['Docente', 'Emprendedor', 'Investigadora', 'Comunicador'][i % 4],
        personalidad: i % 2 ? ['Analítica', 'Reservada'] : ['Creativa', 'Comunicativa'],
        categoria: i % 5 === 0 ? 'VIP' : 'Estándar',
      }).returning();
      autorIds.push(autor!.id);
      const inicio = grupo >= 7 ? (local === 7 ? -220 : -35) : local % 2 ? -10 : 7;
      const creado = await crearProyecto({ autorIds: [autor!.id], servicioId: servicio.id, unidadId: unidad.id,
        presupuestoId: presupuesto.id, fechaProgramadaInicio: dia(inicio),
        ...(i % 4 === 0 ? { fechaDeseadaAutor: dia(35) } : {}),
      });
      if (!creado.ok) throw new Error(creado.error);
      const p = creado.proyecto;
      const spec = local % 2 === 0 ? specDemo : equipo.filter(u => u.id !== specDemo.id)[(i - 1) % (equipo.length - 1)]!;
      const caso = { id: p.id, codigo: p.codigo, autor: nombre, servicio: servicio.codigo,
        escenario: grupos[grupo]!, especialista: grupo >= 6 ? spec.nombre : null };
      casos.push(caso);
      await actualizarSeccionProyectoPerfil(p.id, {
        ingresoServicioEjecucion: 'Normal', ingresoServicioAlianza: i % 7 === 0,
        ingresoObservaciones: `DEMO · ${caso.escenario}. Datos ficticios para pruebas.`,
      }, comercial);
      await actualizarSeccionProyectoContrato(p.id, {
        capitulosPactados: ['1 a 5', '6 a 10', '11 a 20'][i % 3],
        paginasPactadas: grupo === 0 ? null : ['50', '100', '150', '200'][i % 4],
        criterioExtra: i % 3 === 0 ? 'DEMO · Incluir guía de lectura al final.' : null,
      }, comercial);
      if (grupo >= 2) asegurar(await notificarRrppProyectoBase(p.id, comercial.id));
      if (grupo >= 3) {
        await actualizarSeccionFichaEditorial(p.id, {
          temaGeneral: ['Memorias personales', 'Liderazgo cotidiano', 'Historias familiares', 'Bienestar emocional'][i % 4],
          posibleTituloLibro: titulo, tonoEstilo: i % 2 ? 'Cercano y reflexivo' : 'Narrativo y práctico',
          ...(grupo >= 4 ? { coleccionPanhouse: i % 2 ? 'Literatura' : 'Liderazgo', publicoSexo: 'Mixto',
            publicoEdad: 'Adultos', publicoPerfil: 'Lectores interesados en historias y aprendizajes personales',
            propositoSocial: 'DEMO · Compartir experiencias y promover la lectura.',
            objetivoComercial: ['Posicionar al autor', 'Presentación del libro'], fechaDeseadaCulminacion: dia(90) } : {}),
        }, rrpp);
        await actualizarSeccionMatrizIngreso(p.id, {
          matrizCiudadResidencia: lugar.ciudad, matrizEstadoReunion: 'Reunión de ingreso',
          matrizPropietario: i % 2 ? 'Daniel Valente' : 'Paola Morales',
          matrizBienvenidaGenerada: true, matrizContratoFirmado: grupo >= 4,
          matrizDiagnosticoGenerado: true, matrizIngresoGenerado: grupo >= 4,
          matrizLinkResumen: enlace(`${p.codigo}/resumen`), matrizLinkDiagnostico: enlace(`${p.codigo}/diagnostico`),
          matrizObservacionesComerciales: grupo === 3 ? 'DEMO · Falta terminar documento de ingreso y validar objetivos.' : 'DEMO · Ingreso completo, documentación ficticia validada.',
          ...(grupo >= 4 ? { matrizVentaCruzada: ['Impresión', 'Feria'] } : {}),
        }, rrpp);
        if (servicio.codigo === 'CR' && grupo >= 4) await actualizarSeccionProyectoPerfil(p.id,
          { ingresoServicioSubtipoCrudo: local % 2 ? 'Tripa' : 'Capítulo' }, rrpp);
      }
      if (grupo >= 5) asegurar(await notificarJefaturaFichaCompletada(p.id, rrpp.id));
      if (grupo >= 6) {
        await db.transaction(async tx => {
          await asignarConHistorial(tx, { proyectoId: p.id, tipo: 'jefe_area', usuarioId: jefa.id, asignadoPorId: jefa.id });
          await tx.update(proyectos).set({ jefeAreaId: jefa.id }).where(eq(proyectos.id, p.id));
        });
        await asignarEspecialista(p.id, spec.id, jefa.id, { exigirHandoff: true });
      }
      if (grupo >= 7) {
        await db.update(proyectos).set({ tituloDefinitivo: titulo, subtituloDefinitivo: 'Historias y aprendizajes · demostración',
          fechaRealInicio: dia(-30) }).where(eq(proyectos.id, p.id));
        if (servicio.codigo !== 'SE') {
          await solicitarEditor(p.id, spec.id);
          if (!(grupo === 8 && local < 2)) {
            await asignarEditor(p.id, editor.id, jefeEdicion.id);
            for (let cap = 1; cap <= 6; cap++) {
              await crearCapitulo(p.id, cap);
              if (cap <= 3 || grupo === 9) {
                await actualizarCapituloEditor(p.id, cap, { paginas: 12 + cap, fechaInicioEditor: dia(-20 + cap), fechaEntregaEditor: dia(-16 + cap) });
                if (cap <= 2 || grupo === 9) await actualizarCapituloAutor(p.id, cap, {
                  enlaces: [enlace(`${p.codigo}/capitulo-${cap}`)], fechaEnvioAutor: dia(-12 + cap),
                  ...(cap === 1 || grupo === 9 ? { fechaRespuestaReal: dia(-7 + cap) } : {}),
                }, spec.id);
              } else if (cap === 4) await actualizarCapituloEditor(p.id, cap, { paginas: 15, fechaInicioEditor: dia(-2) });
            }
          }
        }
      }
      if (grupo === 7 && local === 6) {
        await actualizarProyecto(p.id, { estado: 'stand_by', categoriaStandBy: 'retorno_breve' }, spec);
        caso.escenario += ' · stand-by';
      }
      if (grupo === 7 && local === 7) {
        await actualizarProyecto(p.id, { estado: 'retrasado' }, spec);
        caso.escenario += ' · retrasado';
      }
      if (grupo === 8) {
        if (local < 2) caso.escenario = 'Especialista: solicitud de Editor enviada';
        else {
          const c = await solicitarCorreccion(p.id, { alcance: 'tripa_completa', paginas: 140 + 10 * local }, spec.id);
          const [d] = await db.select().from(decisiones).where(eq(decisiones.originCorreccionId, c.id));
          if (!d) throw new Error('No se generó la decisión de revisión previa.');
          if (local >= 3) asegurar(await iniciarRevision(d.id, jefa));
          if ([4, 5].includes(local)) asegurar(await solicitarInformacion(d.id, jefa, 'DEMO · Confirma la extensión y adjunta el diagnóstico actualizado.'));
          if (local === 5) asegurar(await responderInformacion(d.id, spec, 'DEMO · Extensión confirmada; diagnóstico ficticio disponible en la ficha.'));
          if (local >= 6) asegurar(await resolverDecision(d.id, jefa, local === 6 ? 'approved' : 'rejected',
            local === 6 ? 'DEMO · Diagnóstico favorable, continuar corrección.' : 'DEMO · Completar la estructura antes de corregir.', undefined));
          caso.escenario = ['Decisión pendiente', 'Decisión en revisión', 'Decisión esperando información', 'Respuesta enviada a Jefatura', 'Decisión aprobada', 'Decisión rechazada'][local - 2]!;
        }
      }
      if (grupo === 9) {
        if (servicio.codigo !== 'SE') await registrarFeedbackTripa(p.id, dia(-1), spec.id);
        else await asignarDisenador(p.id, disenador.id, spec.id);
        const c = await solicitarCorreccion(p.id, { alcance: 'tripa_completa', paginas: 96 }, spec.id);
        if (local >= 1) asegurar(await asignarCorrector(c.id, { correctorId: corrector!.id, freelance: false, contratoConfirmado: true }, spec.id));
        if (local >= 2) await marcarInicioCorreccion(c.id, undefined, corrector!.id);
        if (local >= 4) await registrarEntregaCorreccion(c.id, { controlCambiosUrl: enlace(`${p.codigo}/tripa-corregida`),
          informeTecnicoUrl: enlace(`${p.codigo}/informe`), motivo: 'DEMO · Entrega ficticia enviada al Especialista.' }, corrector!.id);
        if (local >= 6) await cerrarCorreccion(c.id, { resultado: local === 6 ? 'buena' : 'regular', observaciones: 'DEMO · Corrección evaluada y cerrada.' }, spec.id);
        const dc = asegurar(await solicitarDireccionCreativa(p.id, spec.id));
        if (!dc.id) throw new Error('No se generó la solicitud creativa.');
        if (local >= 2) asegurar(await asignarLiderCreativo(dc.id, creativo.id, jefa.id));
        if (local >= 3) {
          await registrarReunionCreativa(dc.id, { fecha: dia(-1), realizada: true, enlaceGrabacion: enlace(`${p.codigo}/reunion-creativa`) }, creativo.id);
          await registrarBrief(dc.id, { briefEnlace: enlace(`${p.codigo}/brief`), fechaBriefEnviadoEspecialista: hoy }, creativo.id);
        }
        if (local >= 5) await registrarBriefAutor(dc.id, { fechaBriefEnviadoAutor: hoy, ...(local >= 7 ? { fechaBriefAprobadoAutor: hoy } : {}) }, spec.id);
        await asignarResponsableLanzamiento(p.id, rrpp.id, rrpp.id);
        await actualizarPlanificacion(p.id, planLanzamientoSchema.parse({
          asesoriaFase: local < 4 ? 'En asesoramiento' : 'En espera de lanzamiento',
          lanzamientoPromocionFechaTentativa: dia(25 + local), lanzamientoPromocionTipo: local % 2 ? 'Lanzamiento digital' : 'Presentación',
          lanzamientoPromocionObjetivoComercial: 'DEMO · Presentar la obra y acercar al autor a sus lectores.',
          lanzamientoPromocionParticipacionFerias: local % 2 ? 'Sí' : 'Pendiente',
          lanzamientoPromocionObservaciones: 'DEMO · Planificación ficticia en distintos grados de avance.',
          ...(local >= 4 ? { asesoriaLinkRutaPromocion: enlace(`${p.codigo}/ruta-promocion`), asesoriaRutaPromocionEnviada: true } : {}),
        }), rrpp.id);
        await registrarReunionLanzamiento(p.id, reunionLanzamientoSchema.parse({ clientKey: randomUUID(),
          fecha: local < 4 ? dia(3 + local) : dia(-1), realizada: local >= 4, responsableId: rrpp.id,
          puntosTratados: 'DEMO · Audiencia, presentación y acciones de promoción.', acuerdos: local >= 4 ? 'DEMO · Ruta de promoción enviada.' : null,
        }), rrpp.id);
        await guardarEventoRrpp(eventoRrppSchema.parse({ proyectoId: p.id, clientKey: randomUUID(),
          tipo: local % 2 ? 'Lanzamiento digital' : 'Firma de libros', estado: local < 4 ? 'No iniciada' : 'En curso',
          fase: 'Antes del evento', fecha: dia(25 + local), hora: '18:00', lugar: 'DEMO · Sala cultural ficticia',
          responsableId: rrpp.id, notasRrss: 'DEMO · Preparar convocatoria y difusión.',
        }), rrpp.id);
        await guardarPublicacionRrpp(publicacionRrppSchema.parse({ proyectoId: p.id, clientKey: randomUUID(),
          tipo: 'Novedades', estado: local < 3 ? 'Nuevo' : local < 6 ? 'En curso' : 'Publicado',
          estadoPieza: local < 3 ? 'pieza en desarrollo' : local < 6 ? 'Con pieza lista' : 'Publicado',
          responsableId: rrpp.id, detalles: 'DEMO · Anuncio ficticio de la próxima obra.', notas: 'Datos de prueba locales.',
        }), rrpp.id);
        caso.escenario = `${local === 0 ? 'Corrección solicitada' : local === 1 ? 'Corrector asignado' : local < 4 ? 'Corrección a mitad' : local < 6 ? 'Corrección entregada, por revisar' : 'Corrección cerrada'} · creativa y lanzamiento en paralelo`;
      }
      console.log(`${i + 1}/80 · #${p.codigo} · ${caso.escenario}`);
    }
    // Comprueba estados reales y relaciones de las filas creadas, además de preservar lo preexistente.
    const ids = casos.map(c => c.id);
    const rows = await db.select({ p: proyectos, f: fichasTrazabilidad, s: servicios }).from(proyectos)
      .innerJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id))
      .innerJoin(servicios, eq(servicios.id, proyectos.servicioId)).where(inArray(proyectos.id, ids));
    const resumen: Record<string, number> = {};
    for (const [i, caso] of casos.entries()) {
      const r = rows.find(r => r.p.id === caso.id)!;
      if (!r) throw new Error(`Proyecto/ficha faltante ${caso.codigo}`);
      const grupo = Math.floor(i / 8);
      const listoComercial = evaluarPreparacionComercial({ ...r.p, ...r.f, autores: [{ id: r.p.autorId }] }).listoParaRrpp;
      const listoRrpp = evaluarPreparacionRrpp(r.f, r.s.codigo).listoParaJefatura;
      if (listoComercial !== (grupo >= 1) || listoRrpp !== (grupo >= 4) || r.p.notificadoRrpp !== (grupo >= 2) ||
          r.p.notificadoJefatura !== (grupo >= 5) || Boolean(r.p.especialistaId) !== (grupo >= 6)) throw new Error(`Estado inesperado ${caso.codigo}`);
      if (grupo >= 6) {
        const [asignacion] = await db.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId, r.p.id), eq(projectAssignments.tipo, 'especialista')));
        if (asignacion?.usuarioId !== r.p.especialistaId) throw new Error('Asignación sin historial consistente.');
      }
      resumen[grupos[grupo]!] = (resumen[grupos[grupo]!] ?? 0) + 1;
    }
    for (const [tabla, antes] of originales) {
      const despues = antes.length ? (await pool.query(`SELECT id,to_jsonb(t) AS datos FROM ${tabla} t WHERE id=ANY($1::uuid[]) ORDER BY id`, [antes.map(r => r.id)])).rows : [];
      if (firma(antes) !== firma(despues)) throw new Error(`Se detectó un cambio en filas preexistentes de ${tabla}`);
    }
    const trabajos = await db.select({ tipo: workItems.tipo, estado: workItems.estado }).from(workItems).where(inArray(workItems.proyectoId, ids));
    await mkdir('docs/demo', { recursive: true });
    await writeFile('docs/demo/panhouse-datos-varios.json', JSON.stringify({
      creadoEn: new Date().toISOString(), fechaReferencia: hoy, demo: true, base: 'panhouse local',
      proyectosNuevos: casos.length, autoresNuevos: autorIds.length, originalesConservados: true,
      resumen, trabajos: trabajos.reduce<Record<string, number>>((a, w) => { const k = `${w.tipo}: ${w.estado}`; a[k] = (a[k] ?? 0) + 1; return a; }, {}), casos,
    }, null, 2) + '\n');
    rollback = false;
    console.log(JSON.stringify({ creados: casos.length, originalesConservados: true, resumen }, null, 2));
  }
} finally {
  try {
    if (rollback) {
      if (casos.length) await db.delete(proyectos).where(inArray(proyectos.id, casos.map(c => c.id)));
      if (autorIds.length) await db.delete(autores).where(inArray(autores.id, autorIds));
      if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    }
  } finally {
    await lock.query('SELECT pg_advisory_unlock(130102026)');
    lock.release();
    await pool.end();
  }
}
