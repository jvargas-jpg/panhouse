import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, notificaciones, workItems } from '../server/db/schema/index.js';
import { crearFichaTrazabilidad } from '../server/helpers/trazabilidad.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

// §25/§31 del master prompt de rearquitectura: flujo completo
// Comercial→RRPP→Jefatura→Especialista, con work items, auditoría e
// idempotencia verificadas de punta a punta (no solo por pieza suelta).
describe('Workflow Core: Comercial → RRPP → Jefatura → Especialista', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  async function crearProyectoConFicha() {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);
    return proyecto;
  }

  it('recorre la cascada completa dejando work items, auditoría y notificaciones correctos en cada paso', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const proyecto = await crearProyectoConFicha();
    const especialista = await crearUsuario('especialista');

    const cookieComercial = await registrarYLoguear(app, 'comercial');
    const cookieRrpp = await registrarYLoguear(app, 'rrpp');
    const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');

    // Paso 1: Comercial → RRPP.
    const r1 = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookieComercial);
    expect(r1.status).toBe(201);

    let intake = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'intake_rrpp')));
    expect(intake).toHaveLength(1);
    expect(intake[0]?.estado).toBe('pendiente');

    let eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
    expect(eventos.map((e) => e.accion)).toEqual(['RRPP_NOTIFICADO']);

    // Paso 2: RRPP → Jefatura.
    const r2 = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookieRrpp);
    expect(r2.status).toBe(201);

    intake = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'intake_rrpp')));
    expect(intake[0]?.estado).toBe('completado');

    const asignacionWorkItem = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'asignacion_especialista')));
    expect(asignacionWorkItem).toHaveLength(1);
    expect(asignacionWorkItem[0]?.estado).toBe('pendiente');

    eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
    expect(eventos.map((e) => e.accion).sort()).toEqual(['JEFATURA_NOTIFICADA', 'RRPP_NOTIFICADO'].sort());

    // Paso 3: Jefatura → Especialista.
    const r3 = await request(app.server)
      .patch(`/api/proyectos/${proyecto.id}/especialista`)
      .set('Cookie', cookieJefeArea)
      .send({ especialistaId: especialista.id });
    expect(r3.status).toBe(200);

    const asignacionFinal = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'asignacion_especialista')));
    expect(asignacionFinal[0]?.estado).toBe('completado');

    eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
    expect(eventos.map((e) => e.accion).sort()).toEqual(['ESPECIALISTA_ASIGNADO', 'JEFATURA_NOTIFICADA', 'RRPP_NOTIFICADO'].sort());

    // La notificación de asignación fue puntual al especialista, no un
    // broadcast a todo el rol.
    const notifEspecialista = await db
      .select()
      .from(notificaciones)
      .where(and(eq(notificaciones.proyectoId, proyecto.id), eq(notificaciones.rolDestino, 'especialista')));
    expect(notifEspecialista).toHaveLength(1);
    expect(notifEspecialista[0]?.usuarioDestinoId).toBe(especialista.id);

    await app.close();
  });

  it('idempotencia de punta a punta: repetir cada paso del handoff no duplica work items ni eventos de auditoría', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const proyecto = await crearProyectoConFicha();
    const especialista = await crearUsuario('especialista');
    const cookieComercial = await registrarYLoguear(app, 'comercial');
    const cookieRrpp = await registrarYLoguear(app, 'rrpp');
    const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');

    await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookieComercial);
    const repiteRrpp = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookieComercial);
    expect(repiteRrpp.status).toBe(409);

    await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookieRrpp);
    const repiteJefatura = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookieRrpp);
    expect(repiteJefatura.status).toBe(409);

    await request(app.server).patch(`/api/proyectos/${proyecto.id}/especialista`).set('Cookie', cookieJefeArea).send({ especialistaId: especialista.id });
    // Reasignar al MISMO especialista (doble click accidental del
    // mismo valor) — no debe crear una segunda fila de asignación ni un
    // segundo evento de auditoría de "asignado".
    await request(app.server).patch(`/api/proyectos/${proyecto.id}/especialista`).set('Cookie', cookieJefeArea).send({ especialistaId: especialista.id });

    const workItemsDelProyecto = await db.select().from(workItems).where(eq(workItems.proyectoId, proyecto.id));
    expect(workItemsDelProyecto).toHaveLength(2); // intake_rrpp + asignacion_especialista, cada uno UNA fila

    const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
    expect(eventos).toHaveLength(3); // RRPP_NOTIFICADO + JEFATURA_NOTIFICADA + ESPECIALISTA_ASIGNADO, cada uno UNA vez

    const notifs = await db
      .select()
      .from(notificaciones)
      .where(and(eq(notificaciones.proyectoId, proyecto.id), eq(notificaciones.rolDestino, 'especialista')));
    expect(notifs).toHaveLength(1);

    await app.close();
  });
});
