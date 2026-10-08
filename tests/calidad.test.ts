import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { auditLogs, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichasTrazabilidad, notificaciones, projectAssignments, proyectos, workItems } from '../server/db/schema/index.js';
import { criteriosDeFase } from '../server/helpers/calidad.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

describe('5E Calidad — rondas canónicas y bandeja compartida', () => {
  let app: ReturnType<typeof buildApp>;
  let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>;
  let especialista: Awaited<ReturnType<typeof crearUsuario>>;
  let disenador: Awaited<ReturnType<typeof crearUsuario>>;
  let soporte: Awaited<ReturnType<typeof crearUsuario>>;
  let cookies: Record<string, string>;
  let disenoId: string; let versionId: string; let faseId: string;
  const lista = (fase = 1) => Object.fromEntries(criteriosDeFase(fase).map(c => [c, { cumple: true }]));
  const resultado = (extra = {}) => ({ aprobar: true, cantidadComentarios: 0, checklist: lista(), ...extra });
  async function login(u: Awaited<ReturnType<typeof crearUsuario>>) {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' } });
    return r.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
  async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: any, cookie = cookies.especialista) {
    const r = await app.inject({ method, url: `/api${path}`, headers: { cookie }, payload }); return { status: r.statusCode, body: r.json() };
  }
  const revisar = (id = faseId, payload: unknown = resultado(), cookie = cookies.soporte) => call('PATCH', `/calidad/${id}/resultado`, payload, cookie);
  const coordinar = (accion: string, extra = {}, id = faseId, cookie = cookies.especialista) => call('PATCH', `/calidad/${id}/coordinacion`, { accion, ...extra }, cookie);
  async function entregar() {
    const r = await call('POST', `/diseno/${disenoId}/versiones`, { enlace: `https://drive.google.com/${randomUUID()}`, entregaKey: randomUUID() }, cookies.disenador);
    expect(r.status).toBe(201); versionId = r.body.id;
    expect((await call('PATCH', `/diseno/${disenoId}/versiones/${versionId}`, { accion: 'handoff_calidad' })).status).toBe(200);
    const [v] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, versionId)); faseId = v!.calidadFaseId!;
  }
  beforeEach(async () => {
    await limpiarBaseDeDatos(); app = buildApp(); await app.ready();
    especialista = await crearUsuario('especialista'); disenador = await crearUsuario('disenador'); soporte = await crearUsuario('soporte_editorial');
    p = await crearProyectoDePrueba({ especialistaId: especialista.id, disenadorId: disenador.id });
    await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
    const [cw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
    const [dc] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
    const [dw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', estado: 'en_progreso' }).returning();
    const [d] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: dw!.id, tipo: 'diagramacion', direccionCreativaId: dc!.id, fuenteUrl: 'https://drive.google.com/tripa', solicitudKey: randomUUID(), preparacionConfirmada: true }).returning();
    disenoId = d!.id; cookies = { especialista: await login(especialista), disenador: await login(disenador), soporte: await login(soporte) };
    await entregar();
  });
  afterEach(async () => { await app.close(); });
  it('handoff consume versión y tripa canónicas; bandeja compartida permite iniciar y revisar por personas distintas', async () => {
    const otro = await crearUsuario('soporte_editorial'); const cookie = await login(otro);
    const q = await call('GET', '/calidad/bandeja', undefined, cookie);
    expect(q.body.rondas[0]).toMatchObject({ id: faseId, disenoVersionId: versionId, fuenteUrl: 'https://drive.google.com/tripa', numeroFase: 1, ronda: 1, activa: true });
    const body = { dueAt: '2026-12-01T10:00:00-04:00' };
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, body, cookies.soporte)).status).toBe(200);
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, body, cookies.soporte)).status).toBe(200);
    expect((await revisar(faseId, resultado(), cookie)).status).toBe(200);
    const [r] = await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId));
    expect(r?.revisadoPorId).toBe(otro.id); expect(r?.nombreQuienRecibe).toBe(otro.nombre); expect(r?.dueAt?.toISOString()).toBe('2026-12-01T14:00:00.000Z');
    expect(await db.select().from(projectAssignments).where(eq(projectAssignments.tipo, 'validador'))).toHaveLength(0);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'CALIDAD_INICIADA'))).toHaveLength(1);
  });
  it('no aprueba checklist incompleto, criterios fallidos o comentarios pendientes', async () => {
    expect((await revisar(faseId, resultado({ checklist: {} }))).status).toBe(400);
    expect((await revisar(faseId, resultado({ checklist: { ...lista(), indice: { cumple: false } } }))).status).toBe(409);
    expect((await revisar(faseId, resultado({ cantidadComentarios: 2 }))).status).toBe(409);
    expect((await revisar(faseId, resultado({ checklist: { ...lista(), fotografias: { cumple: null } } }))).status).toBe(200);
  });
  it('no devuelve ajustes sin PDF comentado/total real ni acepta datos inválidos', async () => {
    expect((await revisar(faseId, resultado({ aprobar: false, cantidadComentarios: 2 }))).status).toBe(400);
    expect((await revisar(faseId, resultado({ aprobar: false, cantidadComentarios: 0, comentariosUrl: 'https://drive.google.com/comentarios' }))).status).toBe(400);
    expect((await revisar(faseId, resultado({ cantidadComentarios: -1 }))).status).toBe(400);
    expect((await revisar(faseId, resultado({ comentariosUrl: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await revisar(faseId, resultado({ revisadoPorId: especialista.id }))).status).toBe(400);
  });
  it('resolver concurrentemente es idempotente, conserva hora y no duplica audit/notificaciones', async () => {
    const body = resultado({ aprobar: false, cantidadComentarios: 2, comentariosUrl: 'https://drive.google.com/comentarios' });
    const rs = await Promise.all([revisar(faseId, body), revisar(faseId, body)]); expect(rs.map(r => r.status)).toEqual([200, 200]);
    const [antes] = await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId));
    await revisar(faseId, body);
    expect((await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId)))[0]!.revisadoEn).toEqual(antes!.revisadoEn);
    expect((await revisar(faseId, resultado())).status).toBe(409);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'CALIDAD_REVISADA'))).toHaveLength(1);
    expect(await db.select().from(notificaciones).where(and(eq(notificaciones.rolDestino, 'disenador'), eq(notificaciones.usuarioDestinoId, disenador.id)))).toHaveLength(1);
    expect((await db.select().from(disenos).where(eq(disenos.id, disenoId)))[0]?.cerradoEn).toBeNull();
  });
  it('F1 → ajustes de Diseño → F2.1 → F2.2… soporta N rondas sin duplicar versiones ni borrar historia', async () => {
    const primera = faseId;
    expect((await revisar(faseId, resultado({ aprobar: false, cantidadComentarios: 2, comentariosUrl: 'https://drive.google.com/comentarios' }))).status).toBe(200);
    for (let ronda = 1; ronda <= 6; ronda++) {
      await entregar();
      const [q] = await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId));
      expect(q).toMatchObject({ numeroFase: 2, ronda, cambiosPorVerificar: 2 });
      if (ronda < 6) expect((await revisar(faseId, { aprobar: false, cantidadComentarios: 2, cambiosPendientesPorAplicar: 1, cambiosNuevosSugeridos: 1, comentariosUrl: 'https://drive.google.com/comentarios' })).status).toBe(200);
      else expect((await revisar(faseId, { aprobar: true, cantidadComentarios: 0, cambiosPendientesPorAplicar: 0, cambiosNuevosSugeridos: 0 })).status).toBe(200);
    }
    expect(await db.select().from(disenoVersiones)).toHaveLength(7); expect(await db.select().from(fichaCalidadFases)).toHaveLength(7);
    expect((await revisar(primera, resultado())).status).toBe(404);
    const bandeja = await call('GET', '/calidad/bandeja', undefined, cookies.soporte);
    expect(bandeja.body.rondas.filter((r: any) => r.activa)).toHaveLength(1);
    expect(bandeja.body.rondas[0].comentariosAnterioresUrl).toBe('https://drive.google.com/comentarios');
  });
  it('valida contadores de pendientes/nuevos y no permite aprobar sin verificarlos', async () => {
    await revisar(faseId, resultado({ aprobar: false, cantidadComentarios: 3, comentariosUrl: 'https://drive.google.com/comentarios' })); await entregar();
    expect((await revisar(faseId, { aprobar: true, cantidadComentarios: 0 })).status).toBe(400);
    expect((await revisar(faseId, { aprobar: false, cantidadComentarios: 4, cambiosPendientesPorAplicar: 1, cambiosNuevosSugeridos: 2, comentariosUrl: 'https://drive.google.com/comentarios' })).status).toBe(400);
  });
  it('Autor recibe solo PDF aprobado por Calidad; bypass por Diseño está cerrado', async () => {
    expect((await coordinar('enviar_autor')).status).toBe(409);
    expect((await call('PATCH', `/diseno/${disenoId}/versiones/${versionId}`, { accion: 'enviar_autor' })).status).toBe(409);
    await revisar(); expect((await coordinar('aprobar_autor')).status).toBe(409);
    expect((await coordinar('enviar_autor')).status).toBe(200); expect((await coordinar('enviar_autor')).status).toBe(200);
    expect((await coordinar('aprobar_autor')).status).toBe(200); expect((await coordinar('aprobar_autor')).status).toBe(200);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'CALIDAD_ENVIADA_AUTOR'))).toHaveLength(1);
  });
  it('feedback de Autor exige PDF marcado, abre Diseño y vuelve a F2 con el total del Autor', async () => {
    await revisar(); await coordinar('enviar_autor');
    expect((await coordinar('feedback_autor', { feedback: 'Ajustar', cantidadComentarios: 3 })).status).toBe(400);
    const extra = { feedback: 'Ajustar', cantidadComentarios: 3, comentariosUrl: 'https://drive.google.com/autor' };
    expect((await coordinar('feedback_autor', extra)).status).toBe(200); expect((await coordinar('feedback_autor', extra)).status).toBe(200);
    expect((await coordinar('aprobar_autor')).status).toBe(409);
    await entregar(); const [q] = await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId));
    expect(q).toMatchObject({ numeroFase: 2, cambiosPorVerificar: 3 });
    const bandeja = await call('GET', '/calidad/bandeja', undefined, cookies.soporte); expect(bandeja.body.rondas[0].comentariosAnterioresUrl).toBe(extra.comentariosUrl);
  });
  it('revisión final exige Autor aprobado y retry concurrente no duplica F3 ni avisos', async () => {
    await revisar(); expect((await coordinar('revision_final')).status).toBe(409);
    await coordinar('enviar_autor'); await coordinar('aprobar_autor');
    const rs = await Promise.all([coordinar('revision_final'), coordinar('revision_final')]); expect(rs.map(r => r.status)).toEqual([200, 200]);
    expect(await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.numeroFase, 3))).toHaveLength(1);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'CALIDAD_REVISION_FINAL_SOLICITADA'))).toHaveLength(1);
    expect(await db.select().from(workItems).where(eq(workItems.tipo, 'calidad'))).toHaveLength(2);
  });
  it('F3 → ajustes → F4.x; solo aprobación final deja output listo para paquete final', async () => {
    await revisar(); await coordinar('enviar_autor'); await coordinar('aprobar_autor'); await coordinar('revision_final', { numerosLegalesUrl: 'https://drive.google.com/rrpp-legales' });
    faseId = (await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, versionId)))[0]!.calidadFaseId!;
    expect((await revisar(faseId, resultado({ checklist: lista(3), aprobar: false, cantidadComentarios: 1, comentariosUrl: 'https://drive.google.com/final' }))).status).toBe(200);
    await entregar(); const [q] = await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId)); expect(q).toMatchObject({ numeroFase: 4, ronda: 1 });
    expect((await revisar(faseId, { aprobar: true, cantidadComentarios: 0, cambiosPendientesPorAplicar: 0, cambiosNuevosSugeridos: 0 })).status).toBe(200);
    const bandeja = await call('GET', '/calidad/bandeja', undefined, cookies.soporte);
    expect(bandeja.body.rondas[0]).toMatchObject({ tripaLista: true, cubiertaLista: false, listoPaqueteFinal: false });
    expect((await call('POST', `/diseno/${disenoId}/versiones`, { enlace: 'https://drive.google.com/extra', entregaKey: randomUUID() }, cookies.disenador)).status).toBe(409);
  });
  it('RBAC/IDOR: diseñador, corrector, editor, creativo y especialista no revisan; especialista ajeno no coordina ni lee', async () => {
    for (const rol of ['disenador', 'corrector', 'editor', 'lider_creativo', 'especialista'] as const) {
      const cookie = await login(await crearUsuario(rol)); expect((await revisar(faseId, resultado(), cookie)).status).toBe(403);
      expect((await call('GET', '/calidad/bandeja', undefined, cookie)).status).toBe(403);
    }
    const ajeno = await login(await crearUsuario('especialista'));
    expect((await coordinar('enviar_autor', {}, faseId, ajeno)).status).toBe(403);
    expect((await call('GET', `/calidad/proyecto/${p.id}`, undefined, ajeno)).status).toBe(403);
    expect((await revisar(randomUUID())).status).toBe(404);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'CALIDAD_REVISADA'))).toHaveLength(0);
  });
  it('rutas legacy no alteran ni eliminan una ronda operativa protegida', async () => {
    const url = `/fichas-trazabilidad/${p.id}/calidad/fases/${faseId}`;
    expect((await call('PATCH', url, { numeroFase: 4, aprobado: true }, cookies.soporte)).status).toBe(404);
    expect((await call('DELETE', url, undefined, cookies.soporte)).status).toBe(404);
    expect((await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, faseId)))[0]?.aprobado).toBeNull();
  });
  it('las relaciones Calidad ↔ versión conservan integridad y permiten CASCADE del proyecto temporal', async () => {
    await revisar(); await coordinar('enviar_autor'); await coordinar('aprobar_autor'); await coordinar('revision_final');
    await db.delete(proyectos).where(eq(proyectos.id, p.id));
    expect(await db.select().from(fichaCalidadFases)).toHaveLength(0); expect(await db.select().from(disenoVersiones)).toHaveLength(0);
  });
  it('SLA se evalúa con la hora de revisión real y no cambia el resultado al consultar', async () => {
    await call('PATCH', `/calidad/${faseId}/inicio`, { dueAt: '2026-01-01T10:00:00Z' }, cookies.soporte);
    await revisar();
    const q = await call('GET', '/calidad/bandeja', undefined, cookies.soporte);
    expect(q.body.rondas[0].plazo).toBe('vencido');
    expect(q.body.rondas[0].revisadoEn).toMatch(/T.*Z$/);
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, { dueAt: '2027-01-01T10:00:00Z' }, cookies.soporte)).status).toBe(409);
  });
  it('listo para paquete final exige la cubierta actual aprobada; una cubierta nueva pendiente cierra el gate', async () => {
    await revisar(); await coordinar('enviar_autor'); await coordinar('aprobar_autor'); await coordinar('revision_final');
    faseId = (await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, versionId)))[0]!.calidadFaseId!;
    expect((await revisar(faseId, resultado({ checklist: lista(3) }))).status).toBe(200);
    const [d] = await db.select().from(disenos).where(eq(disenos.id, disenoId));
    const [wi] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', businessKey: 'cubierta', estado: 'completado' }).returning();
    const [c] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: wi!.id, direccionCreativaId: d!.direccionCreativaId, tipo: 'cubierta_extendida', fuenteUrl: 'https://drive.google.com/cubierta', solicitudKey: randomUUID(), cerradoEn: new Date() }).returning();
    const [rw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', businessKey: 'revision-cubierta', estado: 'completado' }).returning();
    const [rc] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: rw!.id, tipo: 'revision_cubierta', resultadoFinal: 'aprobado' }).returning();
    await db.insert(disenoVersiones).values({ disenoId: c!.id, numero: 1, entregaKey: randomUUID(), enlace: 'https://drive.google.com/cubierta-v1', entregadoPorId: disenador.id, aprobadaAutorEn: new Date(), aprobadaInternaEn: new Date(), revisionCreativaId: rc!.id });
    expect((await call('GET', '/calidad/bandeja', undefined, cookies.soporte)).body.rondas[0].listoPaqueteFinal).toBe(true);
    const [nwi] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', businessKey: 'cubierta-nueva' }).returning();
    await db.insert(disenos).values({ proyectoId: p.id, workItemId: nwi!.id, direccionCreativaId: d!.direccionCreativaId, tipo: 'cubierta_extendida', fuenteUrl: 'https://drive.google.com/nueva', solicitudKey: randomUUID() });
    expect((await call('GET', '/calidad/bandeja', undefined, cookies.soporte)).body.rondas[0].listoPaqueteFinal).toBe(false);
  });
});
