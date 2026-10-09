import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, fichasTrazabilidad, notificaciones, proyectos, ROLES, workItems } from '../server/db/schema/index.js';
import { notificarRrppProyectoBase } from '../server/helpers/proyectos.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearFichaComercialCompleta, crearProyectoDePrueba } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('handoff comercial: garantías e integración', () => {
  let app: ReturnType<typeof crearAppDePrueba>;
  beforeEach(async () => { await limpiarBaseDeDatos(); app = crearAppDePrueba(); await app.ready(); });
  afterEach(async () => { await app.close(); });

  async function efectos(id: string) {
    const [p, eventos, intake, avisos] = await Promise.all([
      db.select().from(proyectos).where(eq(proyectos.id, id)),
      db.select().from(auditLogs).where(eq(auditLogs.proyectoId, id)),
      db.select().from(workItems).where(eq(workItems.proyectoId, id)),
      db.select().from(notificaciones).where(eq(notificaciones.proyectoId, id)),
    ]);
    return { proyecto: p[0], eventos, intake, avisos };
  }
  async function sinEfectos(id: string) {
    const e = await efectos(id);
    expect(e.proyecto?.notificadoRrpp).toBe(false);
    expect(e.eventos).toHaveLength(0); expect(e.intake).toHaveLength(0); expect(e.avisos).toHaveLength(0);
  }

  it.each(['sin ficha', 'ingresoFechaIngreso', 'capitulosPactados', 'paginasPactadas'] as const)(
    'rechaza POST directo incompleto (%s) sin efectos secundarios', async (campo) => {
      const p = await crearProyectoDePrueba();
      if (campo !== 'sin ficha') {
        await crearFichaComercialCompleta(p.id);
        await db.update(fichasTrazabilidad).set({ [campo]: campo === 'ingresoFechaIngreso' ? null : '  ' }).where(eq(fichasTrazabilidad.proyectoId, p.id));
      }
      const cookie = await registrarYLoguear(app, 'comercial');
      const r = await request(app.server).post(`/api/proyectos/${p.id}/notificar-rrpp`).set('Cookie', cookie);
      expect(r.status).toBe(409); expect(r.body.error).toContain('datos comerciales');
      await sinEfectos(p.id);
    },
  );

  it('dos requests simultáneos y un retry crean un solo handoff, intake, audit y aviso; RRPP recibe el proyecto', async () => {
    const p = await crearProyectoDePrueba();
    const otroListo = await crearProyectoDePrueba();
    await crearFichaComercialCompleta(p.id); await crearFichaComercialCompleta(otroListo.id);
    const cookie = await registrarYLoguear(app, 'comercial');
    const cookieRrpp = await registrarYLoguear(app, 'rrpp');
    const antes = await request(app.server).get('/api/fichas-trazabilidad/enviados-a-rrpp').set('Cookie', cookieRrpp);
    expect(antes.status).toBe(200); expect(antes.body.proyectos).toHaveLength(0);
    const respuestas = await Promise.all([0, 1].map(() => request(app.server).post(`/api/proyectos/${p.id}/notificar-rrpp`).set('Cookie', cookie)));
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    const retry = await request(app.server).post(`/api/proyectos/${p.id}/notificar-rrpp`).set('Cookie', cookie);
    expect(retry.status).toBe(409); expect(retry.body.error).toContain('ya fue');
    const e = await efectos(p.id);
    expect(e.proyecto?.notificadoRrpp).toBe(true); expect(e.proyecto?.estado).toBe(p.estado);
    expect(e.intake).toHaveLength(1); expect(e.intake[0]).toMatchObject({ tipo: 'intake_rrpp', estado: 'pendiente' });
    expect(e.eventos).toHaveLength(1); expect(e.eventos[0]).toMatchObject({ accion: 'RRPP_NOTIFICADO', entityType: 'proyecto', entityId: p.id });
    const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200); expect(e.eventos[0]?.actorId).toBe(me.body.user.id);
    expect(e.avisos).toHaveLength(1); expect(e.avisos[0]).toMatchObject({ rolDestino: 'rrpp', proyectoId: p.id });
    const activos = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);
    expect(activos.status).toBe(200);
    expect(activos.body.proyectos.find((v: { id: string }) => v.id === p.id)).toMatchObject({ listoParaRrpp: true, notificadoRrpp: true, rrppEnviadoAt: e.eventos[0]?.createdAt.toISOString() });
    expect(activos.body.proyectos.find((v: { id: string }) => v.id === otroListo.id)).toMatchObject({ listoParaRrpp: true, notificadoRrpp: false, rrppEnviadoAt: null });
    const detalle = await request(app.server).get(`/api/proyectos/${p.id}/riesgo`).set('Cookie', cookie);
    expect(detalle.status).toBe(200); expect(detalle.body.proyecto.rrppEnviadoAt).toBe(e.eventos[0]?.createdAt.toISOString());
    const inbox = await request(app.server).get('/api/fichas-trazabilidad/enviados-a-rrpp').set('Cookie', cookieRrpp);
    expect(inbox.status).toBe(200); expect(inbox.body.proyectos.map((v: { id: string }) => v.id)).toEqual([p.id]);
    const notifs = await request(app.server).get('/api/notificaciones').set('Cookie', cookieRrpp);
    expect(notifs.body.notificaciones).toHaveLength(1);

    // El hecho histórico sobrevive a una corrección posterior de la ficha.
    await db.update(fichasTrazabilidad).set({ paginasPactadas: null }).where(eq(fichasTrazabilidad.proyectoId, p.id));
    const corregido = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);
    expect(corregido.body.proyectos.find((v: { id: string }) => v.id === p.id)).toMatchObject({ listoParaRrpp: false, notificadoRrpp: true });
    expect((await request(app.server).post(`/api/proyectos/${p.id}/notificar-rrpp`).set('Cookie', cookie)).status).toBe(409);
    expect((await efectos(p.id)).eventos).toHaveLength(1);
  });

  it('revierte estado y notificación si falla la auditoría dentro de la transacción', async () => {
    const p = await crearProyectoDePrueba(); await crearFichaComercialCompleta(p.id);
    await expect(notificarRrppProyectoBase(p.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow();
    await sinEfectos(p.id);
  });

  it('no inventa una fecha para un flag legacy sin audit', async () => {
    const p = await crearProyectoDePrueba(); await crearFichaComercialCompleta(p.id);
    await db.update(proyectos).set({ notificadoRrpp: true }).where(eq(proyectos.id, p.id));
    const cookie = await registrarYLoguear(app, 'comercial');
    const r = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);
    expect(r.body.proyectos[0]).toMatchObject({ notificadoRrpp: true, rrppEnviadoAt: null });
  });

  it.each(ROLES.filter((rol) => rol !== 'comercial'))('bloquea al rol %s aun con ficha completa', async (rol) => {
    const p = await crearProyectoDePrueba(); await crearFichaComercialCompleta(p.id);
    const cookie = await registrarYLoguear(app, rol, rol === 'autor' ? p.autorId : undefined);
    const r = await request(app.server).post(`/api/proyectos/${p.id}/notificar-rrpp`).set('Cookie', cookie);
    expect(r.status).toBe(403); await sinEfectos(p.id);
  });
});
