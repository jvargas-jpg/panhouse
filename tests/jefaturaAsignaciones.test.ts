import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  notificaciones,
  projectAssignments,
  proyectos,
  proyectosAutores,
  rolEnum,
  servicios,
  fichasTrazabilidad,
  workItems,
  users,
  type Rol,
} from '../server/db/schema/index.js';
import { crearAutor, crearProyectoDePrueba, crearFichaComercialCompleta } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { createSession } from '../server/helpers/session.js';
import { asignarEspecialista } from '../server/helpers/proyectos.js';
import { obtenerAsignacionesJefatura } from '../server/helpers/jefaturaAsignaciones.js';
import {
  obtenerCargaEspecialista,
  listarCargaEspecialistas,
} from '../server/helpers/carga.js';

const app = buildApp();
let jefe: string, a: string, b: string, cookie: string;
async function usuario(rol: Rol, nombre: string = rol) {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    rol,
    nombre,
    email: `${id}@panhouse.test`,
    passwordHash: 'fixture-session-only',
  });
  return id;
}
async function proyecto(extra: Partial<typeof proyectos.$inferInsert> = {}) {
  const p = await crearProyectoDePrueba();
  await db
    .update(proyectos)
    .set({
      notificadoJefatura: true,
      fechaProgramadaInicio: '2026-10-10',
      ...extra,
    })
    .where(eq(proyectos.id, p.id));
  return p;
}
async function get(url: string, session = cookie) {
  return app.inject({
    method: 'GET',
    url,
    headers: session ? { cookie: session } : {},
  });
}
async function asignar(id: string, target: string, esperado: string | null) {
  return app.inject({
    method: 'PATCH',
    url: `/api/jefatura/proyectos/${id}/especialista`,
    headers: { cookie },
    payload: { especialistaId: target, especialistaActualEsperado: esperado },
  });
}
beforeAll(async () => app.ready());
afterAll(async () => app.close());
beforeEach(async () => {
  await limpiarBaseDeDatos();
  jefe = await usuario('jefe_area');
  a = await usuario('especialista', 'Ana');
  b = await usuario('especialista', 'Beatriz');
  cookie = `panhouse_sid=${await createSession(jefe)}`;
});

describe('Asignaciones y carga: fuente canónica, filtros y proyección', () => {
  it('handoff RRPP → decisión → assignment actualiza Inicio, Proyecto, Ficha e inbox sin activar otros gates', async () => {
    const p = await proyecto({ notificadoJefatura: false, notificadoRrpp: true });
    await crearFichaComercialCompleta(p.id);
    await db.update(fichasTrazabilidad).set({ matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true }).where(eq(fichasTrazabilidad.proyectoId, p.id));
    const rrpp = await usuario('rrpp');
    const handoff = await app.inject({ method: 'POST', url: `/api/proyectos/${p.id}/notificar-jefatura`, headers: { cookie: `panhouse_sid=${await createSession(rrpp)}` } });
    expect(handoff.statusCode).toBe(201);
    const inicioAntes = (await get('/api/jefatura/dashboard')).json();
    expect(inicioAntes.proyectos.find((x: any) => x.id === p.id).porAsignar).toBe(true);
    const fichaAntes = (await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json();
    expect(fichaAntes.myActions[0]).toMatchObject({label:'Asignar Especialista', href:`/?vista=asignaciones&proyecto=${p.id}`});
    expect(fichaAntes.myActions.some((x: any) => /corrección/i.test(x.label))).toBe(false);
    expect(fichaAntes.team.filter((x: any) => x.role === 'Especialista editorial')).toHaveLength(0);
    expect(fichaAntes.relatedProcesses.find((x: any) => x.name === 'Jefatura').state).toBe('Pendiente de asignación');
    expect((await asignar(p.id, a, null)).statusCode).toBe(200);
    const lista = (await get('/api/jefatura/asignaciones?tab=asignados')).json();
    expect(lista.contadores).toMatchObject({ porAsignar: 0, asignados: 1 });
    expect((await get('/api/jefatura/dashboard')).json().proyectos.find((x: any) => x.id === p.id).porAsignar).toBe(false);
    expect((await get(`/api/proyectos/${p.id}/riesgo`)).json().proyecto.especialistaId).toBe(a);
    const ficha = (await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json();
    expect(ficha.team.filter((x: any) => x.role === 'Especialista editorial').map((x: any) => x.name)).toEqual(['Ana']);
    expect(ficha.myActions[0].label).toBe('Supervisar proyecto');
    expect(ficha.myActions.some((x: any) => x.label === 'Asignar Especialista')).toBe(false);
    expect(ficha.relatedProcesses.find((x: any) => x.name === 'Jefatura').state).toBe('Especialista asignado');
    expect(ficha.recentActivity.some((x: any) => x.label === 'Jefatura asignó a Ana')).toBe(true);
    expect(ficha.summary.launchEnabled).toBe(false);
    const sessionA = `panhouse_sid=${await createSession(a)}`;
    expect((await get('/api/proyectos/mios', sessionA)).json().proyectos.some((x: any) => x.id === p.id)).toBe(true);
    const items = await db.select().from(workItems).where(eq(workItems.proyectoId,p.id));
    expect(items.find(x => x.tipo === 'asignacion_especialista')?.estado).toBe('completado');
    expect(items.some(x => ['edicion','correccion','diseno','lanzamiento'].includes(x.tipo))).toBe(false);
    expect(await db.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId,p.id),isNull(projectAssignments.finalizadoEn)))).toHaveLength(1);
    expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,a))).length).toBe(1);
    expect((await db.select().from(auditLogs).where(eq(auditLogs.proyectoId,p.id))).some(x => x.accion === 'ESPECIALISTA_ASIGNADO')).toBe(true);
  });
  it('Corrección contextual ofrece supervisión únicamente cuando hay un work item real y no concede edición', async () => {
    const p = await proyecto();
    await crearFichaComercialCompleta(p.id);
    let ficha = (await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json();
    expect(ficha.traceability.find((x: any) => x.id === 'correccion').workspace).toBeUndefined();
    await db.insert(workItems).values({proyectoId:p.id,tipo:'correccion',estado:'en_progreso'});
    ficha = (await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json();
    expect(ficha.myActions.find((x: any) => /Corrección/.test(x.label))).toMatchObject({label:'Ver seguimiento de Corrección',href:'/?vista=seguimiento'});
    expect((await app.inject({method:'PATCH', url:`/api/fichas-trazabilidad/${p.id}/documental/correccion`, headers:{cookie},payload:{datos:{tripa_15:true}}})).statusCode).toBe(403);
  });
  it('un ingreso no recibido o un proyecto cerrado no ofrece Asignar desde la Ficha', async () => {
    const p = await proyecto({notificadoJefatura:false});
    await crearFichaComercialCompleta(p.id);
    expect((await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json().myActions[0].label).toBe('Supervisar proyecto');
    await db.update(proyectos).set({notificadoJefatura:true,estado:'culminado'}).where(eq(proyectos.id,p.id));
    expect((await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json().myActions.some((x: any) => x.label === 'Asignar Especialista')).toBe(false);
  });
  it('el contexto usa Crudo, ejecución y tiempo comercial canónicos sin redefinir Express ni peso', async () => {
    const p = await proyecto({fechaDeseadaAutor:null});
    await crearFichaComercialCompleta(p.id);
    await db.update(servicios).set({codigo:'CR',pesoComplejidad:7}).where(eq(servicios.id,p.servicioId));
    await db.update(fichasTrazabilidad).set({ingresoServicioSubtipoCrudo:'Tripa',ingresoServicioEjecucion:'Express',ingresoTiempoExpresMeses:3,capitulosPactados:'8',paginasPactadas:'240',matrizDiagnosticoGenerado:true,matrizIngresoGenerado:true}).where(eq(fichasTrazabilidad.proyectoId,p.id));
    const decision = (await get(`/api/jefatura/proyectos/${p.id}/candidatos`)).json();
    expect(decision.contexto).toMatchObject({subtipoCrudo:'Tripa',ejecucion:'Express',tiempoExpressMeses:3,capitulos:'8',paginas:'240',comercial:'Completo',rrpp:'Completo'});
    expect(decision.proyecto.impactoCarga).toBe(7);
    expect(decision.proyecto.express.estado).toBe('normal');
    expect(decision.candidatos.every((x: any) => x.impactoCarga === 7)).toBe(true);
  });
  it('Ficha y Proyecto respetan el historial activo y su acceso aunque la FK esté desincronizada', async () => {
    const p = await proyecto();
    await crearFichaComercialCompleta(p.id);
    await asignarEspecialista(p.id,a,jefe,{exigirHandoff:true});
    await db.update(proyectos).set({especialistaId:b}).where(eq(proyectos.id,p.id));
    const ficha = (await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json();
    expect(ficha.team.filter((x: any) => x.role === 'Especialista editorial').map((x: any) => x.name)).toEqual(['Ana']);
    expect((await get(`/api/proyectos/${p.id}/riesgo`)).json().proyecto.especialistaId).toBe(a);
    expect((await get(`/api/fichas-trazabilidad/${p.id}/resumen`,`panhouse_sid=${await createSession(a)}`)).statusCode).toBe(200);
    expect((await get(`/api/fichas-trazabilidad/${p.id}/resumen`,`panhouse_sid=${await createSession(b)}`)).statusCode).toBe(403);
    await asignarEspecialista(p.id,b,jefe,{exigirHandoff:true});
    const after = (await get(`/api/fichas-trazabilidad/${p.id}/resumen`)).json();
    expect(after.team.filter((x: any) => x.role === 'Especialista editorial').map((x: any) => x.name)).toEqual(['Beatriz']);
    expect(after.recentActivity.some((x: any) => x.label === 'Jefatura reasignó: Ana → Beatriz')).toBe(true);
  });
  it('handoff formal, activos y tabs comparten proyecto, dueño y carga al asignar y reasignar', async () => {
    const p = await proyecto();
    const [servicio] = await db
      .select()
      .from(servicios)
      .where(eq(servicios.id, p.servicioId));
    await proyecto({ notificadoJefatura: false });
    await proyecto({ estado: 'culminado' });
    let lista = (await get('/api/jefatura/asignaciones')).json();
    expect(lista.total).toBe(1);
    expect(lista.proyectos[0].impactoCarga).toBe(servicio!.pesoComplejidad);
    expect((await asignar(p.id, a, null)).statusCode).toBe(200);
    lista = (await get('/api/jefatura/asignaciones?tab=asignados')).json();
    expect(lista.proyectos[0].especialista.id).toBe(a);
    expect(lista.contadores.porAsignar).toBe(0);
    expect(lista.equipo.find((c: any) => c.id === a)).toMatchObject({
      activos: 1,
      carga: servicio!.pesoComplejidad,
    });
    expect((await asignar(p.id, b, a)).statusCode).toBe(200);
    lista = (await get('/api/jefatura/asignaciones?tab=asignados')).json();
    expect(lista.proyectos[0].especialista.id).toBe(b);
    expect(lista.equipo.find((c: any) => c.id === a)).toMatchObject({
      activos: 0,
      carga: 0,
    });
    expect(lista.equipo.find((c: any) => c.id === b)).toMatchObject({
      activos: 1,
      carga: servicio!.pesoComplejidad,
    });
    expect(
      await db
        .select()
        .from(projectAssignments)
        .where(
          and(
            eq(projectAssignments.proyectoId, p.id),
            isNull(projectAssignments.finalizadoEn),
          ),
        ),
    ).toHaveLength(1);
    expect((await db.select().from(auditLogs)).map((e) => e.accion)).toEqual([
      'ESPECIALISTA_ASIGNADO',
      'ESPECIALISTA_REASIGNADO',
    ]);
    expect(
      (await db.select().from(notificaciones)).map((n) => n.usuarioDestinoId),
    ).toEqual([a, b]);
  });
  it('historial activo prevalece sobre una FK desincronizada en lista, panel, Inicio y helper de carga', async () => {
    const p = await proyecto();
    await asignarEspecialista(p.id, a, jefe, { exigirHandoff: true });
    await db
      .update(proyectos)
      .set({ especialistaId: b })
      .where(eq(proyectos.id, p.id));
    const lista = (
      await get('/api/jefatura/asignaciones?tab=asignados')
    ).json();
    const inicio = (await get('/api/jefatura/dashboard')).json();
    expect(lista.proyectos[0]).toMatchObject({
      especialista: { id: a },
      asignacionDesincronizada: true,
    });
    expect(inicio.proyectos[0].especialista.id).toBe(a);
    const peso = lista.proyectos[0].impactoCarga;
    expect(lista.equipo.find((c: any) => c.id === a).carga).toBe(peso);
    expect(lista.equipo.find((c: any) => c.id === b).carga).toBe(0);
    expect(await obtenerCargaEspecialista(a)).toBe(peso);
    expect(await obtenerCargaEspecialista(b)).toBe(0);
    expect(
      (await listarCargaEspecialistas()).find((c) => c.id === a)?.carga,
    ).toBe(peso);
    expect(
      (await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]
        ?.especialistaId,
    ).toBe(b); // GET no repara ni escribe.
  });
  it('proyecta el peso del catálogo, mantiene el actual sin doble conteo y excluye usuarios inactivos', async () => {
    const p = await proyecto();
    await asignarEspecialista(p.id, a, jefe);
    const inactive = await usuario('especialista');
    await db.update(users).set({ activo: false }).where(eq(users.id, inactive));
    const r = (await get(`/api/jefatura/proyectos/${p.id}/candidatos`)).json();
    const peso = r.proyecto.servicio.peso;
    expect(r.candidatos.find((c: any) => c.id === a)).toMatchObject({
      carga: peso,
      impactoCarga: 0,
      cargaProyectada: peso,
      esActual: true,
    });
    expect(r.candidatos.find((c: any) => c.id === b)).toMatchObject({
      carga: 0,
      impactoCarga: peso,
      cargaProyectada: peso,
      recomendado: true,
    });
    expect(r.proyecto.recomendacion.razones[0]).toContain(
      'mínima entre alternativas',
    );
    expect(r.candidatos.some((c: any) => c.id === inactive)).toBe(false);
  });
  it('busca título definitivo, autores, coautores y código; filtra servicio y especialista en backend', async () => {
    const p = await proyecto({
      tituloDefinitivo: 'Café y memoria',
      especialistaId: a,
    });
    const coautor = await crearAutor({ nombre: 'Coautora Unica' });
    await db
      .insert(proyectosAutores)
      .values({ proyectoId: p.id, autorId: coautor.id });
    const otro = await proyecto({ especialistaId: b });
    for (const q of ['cafe', 'Coautora Unica', p.codigo]) {
      const r = (
        await get(
          `/api/jefatura/asignaciones?tab=asignados&q=${encodeURIComponent(q)}`,
        )
      ).json();
      expect(r.proyectos.map((i: any) => i.id)).toEqual([p.id]);
    }
    expect(
      (
        await get(
          `/api/jefatura/asignaciones?tab=asignados&servicioId=${p.servicioId}&especialistaId=${a}`,
        )
      ).json().total,
    ).toBe(1);
    expect(
      (
        await get(
          `/api/jefatura/asignaciones?tab=asignados&especialistaId=${b}`,
        )
      ).json().proyectos[0].id,
    ).toBe(otro.id);
    expect(
      (await get('/api/jefatura/asignaciones?q=sin-resultados')).json(),
    ).toMatchObject({
      total: 0,
      proyectos: [],
      contadores: { porAsignar: 0, asignados: 0, express: 0, enRiesgo: 0 },
    });
  });
  it('ordena impacto y creación, pagina sin perder totales ni duplicar proyectos', async () => {
    const primero = await proyecto({ createdAt: new Date('2026-01-01') });
    const segundo = await proyecto({ createdAt: new Date('2026-02-01') });
    await db
      .update(servicios)
      .set({ pesoComplejidad: 7 })
      .where(eq(servicios.id, segundo.servicioId));
    const mayor = (
      await get('/api/jefatura/asignaciones?orden=mayorImpacto&pageSize=1')
    ).json();
    expect(mayor.proyectos[0].id).toBe(segundo.id);
    expect(mayor).toMatchObject({ total: 2, pages: 2, page: 1 });
    const next = (
      await get(
        '/api/jefatura/asignaciones?orden=mayorImpacto&pageSize=1&page=2',
      )
    ).json();
    expect(next.proyectos[0].id).toBe(primero.id);
    expect(
      (await get('/api/jefatura/asignaciones?orden=recientes')).json()
        .proyectos[0].id,
    ).toBe(segundo.id);
    expect(
      (await get('/api/jefatura/asignaciones?orden=menorImpacto')).json()
        .proyectos[0].id,
    ).toBe(primero.id);
  });
  it('cambio del peso en catálogo se refleja en impacto y proyección sin constantes de UI', async () => {
    const p = await proyecto();
    await db
      .update(servicios)
      .set({ pesoComplejidad: 9 })
      .where(eq(servicios.id, p.servicioId));
    const r = (await get(`/api/jefatura/proyectos/${p.id}/candidatos`)).json();
    const [catalogo] = await db
      .select()
      .from(servicios)
      .where(eq(servicios.id, p.servicioId));
    expect(r.proyecto.impactoCarga).toBe(catalogo!.pesoComplejidad);
    expect(r.candidatos[0].cargaProyectada).toBe(catalogo!.pesoComplejidad);
  });
  it('recomienda más proyectos y menos carga ponderada', async () => {
    for (let n = 0; n < 2; n++) await proyecto({ especialistaId: a });
    for (let n = 0; n < 3; n++) {
      const p = await proyecto({ especialistaId: b });
      await db
        .update(servicios)
        .set({ pesoComplejidad: 1 })
        .where(eq(servicios.id, p.servicioId));
    }
    const p = await proyecto();
    const r = (await get(`/api/jefatura/proyectos/${p.id}/candidatos`)).json();
    expect(r.proyecto.recomendacion.especialistaId).toBe(b);
    expect(r.candidatos.find((c: any) => c.id === b).activos).toBeGreaterThan(
      r.candidatos.find((c: any) => c.id === a).activos,
    );
    expect(r.candidatos.find((c: any) => c.id === b).carga).toBeLessThan(
      r.candidatos.find((c: any) => c.id === a).carga,
    );
  });
  it('Express mantiene el peso y se distingue posible de confirmado; normal sale del tab', async () => {
    const p = await proyecto({ fechaDeseadaAutor: '2026-12-01' });
    let r = (await get('/api/jefatura/asignaciones?tab=express')).json();
    expect(r.proyectos[0].express.estado).toBe('posible');
    const datos = {
      decision: 'confirmado',
      fechaEstandar: r.proyectos[0].express.fechaEstandar,
      fechaDeseada: '2026-12-01',
    };
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/jefatura/proyectos/${p.id}/express`,
          headers: { cookie },
          payload: datos,
        })
      ).statusCode,
    ).toBe(200);
    const confirmado = (
      await get(`/api/jefatura/proyectos/${p.id}/candidatos`)
    ).json();
    expect(confirmado.proyecto.express.estado).toBe('confirmado');
    expect(confirmado.proyecto.impactoCarga).toBe(r.proyectos[0].impactoCarga);
    await app.inject({
      method: 'PATCH',
      url: `/api/jefatura/proyectos/${p.id}/express`,
      headers: { cookie },
      payload: { ...datos, decision: 'normal' },
    });
    expect(
      (await get('/api/jefatura/asignaciones?tab=express')).json().total,
    ).toBe(0);
  });
  it('pausados y stand-by mantienen carga; cerrados dejan de contar; barras son relativas', async () => {
    await proyecto({ especialistaId: a, estado: 'pausado' });
    await proyecto({ especialistaId: a, estado: 'stand_by' });
    await proyecto({ especialistaId: b, estado: 'culminado' });
    const r = (await get('/api/jefatura/asignaciones?tab=asignados')).json();
    expect(r.equipo.find((c: any) => c.id === a)).toMatchObject({
      activos: 2,
      barraRelativa: 100,
    });
    expect(r.equipo.find((c: any) => c.id === b)).toMatchObject({
      activos: 0,
      carga: 0,
      barraRelativa: 0,
    });
    expect(r.referenciaBarra).toBe(r.equipo[0].carga);
  });
  it('rechaza una reasignación basada en dueño obsoleto; retry idéntico no duplica efectos', async () => {
    const p = await proyecto();
    expect((await asignar(p.id, a, null)).statusCode).toBe(200);
    expect((await asignar(p.id, a, null)).statusCode).toBe(200);
    expect((await asignar(p.id, b, null)).statusCode).toBe(409);
    expect(await db.select().from(auditLogs)).toHaveLength(1);
    expect(await db.select().from(notificaciones)).toHaveLength(1);
    expect((await asignar(p.id, b, a)).statusCode).toBe(200);
  });
  it('mantiene siete lecturas por lotes con 1 y 31 proyectos, y limita la respuesta paginada', async () => {
    const p = await proyecto();
    const [fila] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, p.id));
    const filtros = {
      tab: 'porAsignar' as const,
      q: '',
      orden: 'urgentes' as const,
      page: 1,
      pageSize: 20,
    };
    const lecturas = vi.spyOn(db, 'select');
    try {
      expect((await obtenerAsignacionesJefatura(filtros)).total).toBe(1);
      expect(lecturas).toHaveBeenCalledTimes(7);
      lecturas.mockClear();
      await db
        .insert(proyectos)
        .values(
          Array.from({ length: 30 }, (_, i) => ({
            ...fila!,
            id: randomUUID(),
            codigo: `PAGE-${i}`,
          })),
        );
      const resultado = await obtenerAsignacionesJefatura(filtros);
      expect(lecturas).toHaveBeenCalledTimes(7);
      expect(resultado).toMatchObject({ total: 31, pages: 2, pageSize: 20 });
      expect(resultado.proyectos).toHaveLength(20);
    } finally {
      lecturas.mockRestore();
    }
  });
  it('no permite comparar proyectos cerrados ni ingresos sin handoff y sin responsable', async () => {
    const cerrado = await proyecto({ estado: 'culminado' });
    const intake = await proyecto({ notificadoJefatura: false });
    for (const p of [cerrado, intake])
      expect(
        (await get(`/api/jefatura/proyectos/${p.id}/candidatos`)).statusCode,
      ).toBe(404);
  });
  it('protege nuevas lecturas para todos los roles ajenos y valida filtros e identificadores', async () => {
    expect((await get('/api/jefatura/asignaciones', '')).statusCode).toBe(401);
    for (const rol of rolEnum.enumValues.filter((r) => r !== 'jefe_area')) {
      const sesion = `panhouse_sid=${await createSession(await usuario(rol))}`;
      expect((await get('/api/jefatura/asignaciones', sesion)).statusCode).toBe(
        403,
      );
      expect(
        (
          await get(
            `/api/jefatura/proyectos/${randomUUID()}/candidatos`,
            sesion,
          )
        ).statusCode,
      ).toBe(403);
    }
    for (const q of [
      'page=-1',
      'pageSize=999',
      'servicioId=no-id',
      'orden=random',
      'tab=otros',
    ])
      expect((await get(`/api/jefatura/asignaciones?${q}`)).statusCode).toBe(
        400,
      );
    expect(
      (await get('/api/jefatura/proyectos/no-id/candidatos')).statusCode,
    ).toBe(400);
    expect(
      (await get(`/api/jefatura/proyectos/${randomUUID()}/candidatos`))
        .statusCode,
    ).toBe(404);
  });
});
