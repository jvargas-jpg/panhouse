import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, autores, capitulos, correcciones, fichaCalidadFases, fichaDocumentalDatos, fichasTrazabilidad, proyectos, servicios, workItems, type Rol } from '../server/db/schema/index.js';
import { asignarEditor, asignarDisenador } from '../server/helpers/proyectos.js';
import { crearFichaTrazabilidad } from '../server/helpers/trazabilidad.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearFichaComercialCompleta, crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import type { CampoFicha, ExpedienteFicha, ResumenFichaViva } from '../shared/fichaViva.js';
describe('Expediente vivo: fuente única, ownership e historia', () => {
    let app: ReturnType<typeof crearAppDePrueba>;
    let cookie: string;
    beforeEach(async () => { await limpiarBaseDeDatos(); app = crearAppDePrueba(); await app.ready(); cookie = await registrarYLoguear(app, 'rrpp'); });
    afterEach(async () => { await app.close(); });
    const base = (id: string) => '/api/fichas-trazabilidad/' + id;
    const get = (id: string, path: string, c = cookie) => request(app.server).get(base(id) + '/' + path).set('Cookie', c);
    const patch = (id: string, area: string, datos: object, c = cookie) => request(app.server).patch(base(id) + '/documental/' + area).set('Cookie', c).send({ datos });
    it('protege las tres lecturas, valida ids y conserva el gate al consultar un proyecto vacío', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        expect((await request(app.server).get(base(p.id) + '/resumen')).status).toBe(401);
        expect((await get('invalido', 'resumen')).status).toBe(400);
        expect((await get(randomUUID(), 'expediente')).status).toBe(404);
        const r = await get(p.id, 'resumen');
        expect(r.status).toBe(200);
        expect(r.body.summary).toMatchObject({ active: 0, completed: 0, launchEnabled: false, launch: 'Aún no habilitado', commercial: 'Pendiente' });
        expect(r.body.traceability).toHaveLength(9);
        expect(r.body.traceability.find((a:{id:string})=>a.id==='edicion').state).toBe('No iniciado');
        expect(r.body.myActions.some((a: {
            href: string;
        }) => a.href.includes('/lanzamientos'))).toBe(false);
        expect(r.body.myActions).toHaveLength(0);
        await get(p.id, 'expediente');
        await get(p.id, 'actividad');
        expect(await db.select().from(workItems).where(eq(workItems.proyectoId, p.id))).toHaveLength(0);
    });
    it.each(['autor', 'cobranzas', 'talento_humano'] as Rol[])('no expone el expediente interno al rol %s', async (role) => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        const c = await registrarYLoguear(app, role);
        for (const endpoint of ['resumen', 'expediente', 'actividad'])
            expect((await get(p.id, endpoint, c)).status).toBe(403);
    });
    it.each(['editor', 'especialista', 'disenador', 'corrector'] as Rol[])('impide consultar y modificar un proyecto ajeno como %s', async (role) => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        const c = await registrarYLoguear(app, role);
        for (const endpoint of ['resumen', 'expediente', 'actividad'])
            expect((await get(p.id, endpoint, c)).status).toBe(403);
        expect((await patch(p.id, 'correccion', { tripa_15: true }, c)).status).toBe(403);
    });
    it('agrega capítulos entregados sin cargar el detalle de capítulos en el resumen', async () => {
        const p=await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        await db.insert(capitulos).values([{proyectoId:p.id,numero:1,fechaEntregaEditor:'2026-10-08'},{proyectoId:p.id,numero:2}]);
        const r=(await get(p.id,'resumen')).body as ResumenFichaViva;
        expect(r.traceability.find(a=>a.id==='edicion')).toMatchObject({state:'En curso',detail:'1 de 2 capítulos entregados por Edición'});
        expect(r).not.toHaveProperty('chapters');
    });
    it('limita los criterios de un corrector al alcance de su intervención vigente', async () => {
        const corrector = await crearUsuario('corrector');
        const p = await crearProyectoDePrueba();
        await db.update(proyectos).set({correctorId:corrector.id}).where(eq(proyectos.id,p.id));
        await crearFichaTrazabilidad(p.id);
        const [wi] = await db.insert(workItems).values({proyectoId:p.id,tipo:'correccion',estado:'en_progreso'}).returning();
        await db.insert(correcciones).values({proyectoId:p.id,workItemId:wi!.id,alcance:'tripa_completa',correctorId:corrector.id});
        const login = await request(app.server).post('/api/auth/login').send({email:corrector.email,password:'password123'});
        const c = login.headers['set-cookie'];
        expect((await patch(p.id,'correccion',{tripa_15:true},c)).status).toBe(200);
        expect((await patch(p.id,'correccion',{preliminares_15:true},c)).status).toBe(403);
        const full = (await get(p.id,'expediente',c)).body as ExpedienteFicha;
        const fields = full.areas.find(a=>a.id==='correccion')!.fields!;
        expect(fields.find(f=>f.key==='tripa_15')?.editable).toBe(true);
        expect(fields.find(f=>f.key==='preliminares_15')?.editable).toBe(false);
        await db.update(workItems).set({estado:'completado'}).where(eq(workItems.id,wi!.id));
        expect((await patch(p.id,'correccion',{tripa_15:false},c)).status).toBe(403);
    });
    it('Comercial actualiza una vez y RRPP lee el mismo dato en resumen, expediente, ingreso y audit', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaComercialCompleta(p.id);
        await db.update(proyectos).set({ notificadoRrpp: true }).where(eq(proyectos.id, p.id));
        const commercial = await registrarYLoguear(app, 'comercial');
        const change = await request(app.server).patch(base(p.id) + '/proyecto-perfil').set('Cookie', commercial).send({ ingresoObservaciones: 'Alianza con biblioteca regional', ingresoServicioPresupuesto: 'Platinium' });
        expect(change.status).toBe(200);
        const summary = await get(p.id, 'resumen');
        expect(summary.body.summary.commercial).toBe('Completo');
        expect(summary.body.overview.find((f:CampoFicha)=>f.key==='ingresoServicioPresupuesto').value).toBe('Platinium');
        const full = await get(p.id, 'expediente');
        expect(full.body.areas[0].fields.find((f: {
            key: string;
        }) => f.key === 'ingresoObservaciones').value).toBe('Alianza con biblioteca regional');
        const intake = await request(app.server).get('/api/rrpp/ingresos/' + p.id).set('Cookie', cookie);
        expect(JSON.stringify(intake.body)).toContain('Alianza con biblioteca regional');
        const history = await get(p.id, 'actividad');
        expect(history.body.items.some((i: {
            label: string;
        }) => i.label === 'Comercial actualizó los datos de la venta')).toBe(true);
    });
    it('RRPP cambia la colección en Ingresos y coincide en resumen, expediente y RRPP Proyectos', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaComercialCompleta(p.id);
        await db.update(proyectos).set({ notificadoRrpp: true }).where(eq(proyectos.id, p.id));
        const result = await request(app.server).patch('/api/rrpp/ingresos/' + p.id).set('Cookie', cookie).send({ coleccionPanhouse: 'PanHouse Kids' });
        expect(result.status).toBe(200);
        const summary = (await get(p.id, 'resumen')).body as ResumenFichaViva;
        expect(summary.overview.find(f => f.key === 'coleccionPanhouse')?.value).toBe('PanHouse Kids');
        const full = (await get(p.id, 'expediente')).body as ExpedienteFicha;
        expect(full.areas[0]?.fields?.find(f => f.key === 'coleccionPanhouse')?.value).toBe('PanHouse Kids');
        const rrpp = await request(app.server).get('/api/rrpp/proyectos/' + p.id + '/resumen').set('Cookie', cookie);
        expect(JSON.stringify(rrpp.body)).toContain('PanHouse Kids');
    });
    it('el hito real de SE crea una planificación única que aparece en Ficha y Lanzamientos', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaComercialCompleta(p.id);
        await db.update(servicios).set({ codigo: 'SE' }).where(eq(servicios.id, p.servicioId));
        expect((await get(p.id, 'resumen')).body.summary.launchEnabled).toBe(false);
        const designer = await crearUsuario('disenador'), specialist = await crearUsuario('especialista');
        await asignarDisenador(p.id, designer.id, specialist.id);
        await asignarDisenador(p.id, designer.id, specialist.id);
        const summary = (await get(p.id, 'resumen')).body;
        expect(summary.summary.launchEnabled).toBe(true);
        expect(summary.myActions.some((a: {
            href: string;
        }) => a.href === '/rrpp/lanzamientos?proyecto=' + p.id)).toBe(true);
        const rows = await db.select().from(workItems).where(and(eq(workItems.proyectoId, p.id), eq(workItems.tipo, 'lanzamiento')));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.businessKey).toBe('planificacion');
        const launch = await request(app.server).get('/api/rrpp/lanzamientos/planes/' + p.id).set('Cookie', cookie);
        expect(launch.status).toBe(200);
    });
    it('RRPP no escribe campos creativos ni operativos de impresión/distribución por ninguna superficie nueva', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaComercialCompleta(p.id);
        expect((await patch(p.id, 'impresion', { cantidadLibros: 50 })).status).toBe(403);
        expect((await patch(p.id, 'distribucion', { nuevoIsbn: '123' })).status).toBe(403);
        expect((await patch(p.id, 'diseno', { archivosCargados: true })).status).toBe(400);
        expect((await patch(p.id, 'diseno', { paqueteFinalCargado: true })).status).toBe(403);
        for (const body of [{ asesoriaCotizacionAceptada: true }, { asesoriaDistribucionAceptada: true }, { asesoriaFechaContratoEnviado: '2026-10-10' }]) {
            expect((await request(app.server).patch(base(p.id) + '/matriz-asesorias').set('Cookie', cookie).send(body)).status).toBe(403);
        }
        expect(await db.select().from(fichaDocumentalDatos)).toHaveLength(0);
    });
    it('conserva Editor A en historia y muestra sólo Editor B vigente tras reasignar', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        const a = await crearUsuario('editor'), b = await crearUsuario('editor'), chief = await crearUsuario('jefe_edicion');
        await asignarEditor(p.id, a.id, chief.id);
        await asignarEditor(p.id, b.id, chief.id);
        const summary = (await get(p.id, 'resumen')).body as ResumenFichaViva;
        expect(summary.team.filter(t => t.role === 'Editor').map(t => t.name)).toEqual([b.nombre]);
        const full = (await get(p.id, 'expediente')).body as ExpedienteFicha;
        expect(full.teamHistory.find(t => t.name === a.nombre)?.endedAt).toBeTruthy();
        expect(full.teamHistory.find(t => t.name === b.nombre)?.endedAt).toBeNull();
        expect(summary.recentActivity.some(a => a.label === 'Se reasignó editor')).toBe(true);
    });
    it('no filtra credenciales ni contactos a otros roles y distingue VIP autor del perfil del proyecto', async () => {
        const editor = await crearUsuario('editor');
        const p = await crearProyectoDePrueba({ editorId: editor.id });
        await crearFichaTrazabilidad(p.id);
        await db.update(autores).set({ categoria: 'VIP', email: ['privado@example.test'], telefono: '+58000123' }).where(eq(autores.id, p.autorId));
        await db.update(fichasTrazabilidad).set({ soporteDigitalCuentaAmazon: 'password=NO_PUBLICAR_TEST' }).where(eq(fichasTrazabilidad.proyectoId, p.id));
        const full = (await get(p.id, 'expediente')).body as ExpedienteFicha;
        expect(JSON.stringify(full)).not.toContain('NO_PUBLICAR_TEST');
        const legacy = await request(app.server).get(base(p.id)).set('Cookie', cookie);
        expect(JSON.stringify(legacy.body)).not.toContain('NO_PUBLICAR_TEST');
        expect(legacy.body.ficha.cuentaAmazonRegistrada).toBe(true);
        expect(full.areas[0]?.fields?.find(f => f.key === 'perfilServicio')?.value).toBeNull();
        const login = await request(app.server).post('/api/auth/login').send({ email: editor.email, password: 'password123' });
        const privateView = await get(p.id, 'expediente', login.headers['set-cookie']);
        expect(JSON.stringify(privateView.body)).not.toContain('privado@example.test');
    });
    it('valida tipos, propietarios y merge idempotente con audit humano sin valores privados', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        const c = await registrarYLoguear(app, 'comercial');
        expect((await patch(p.id, 'proyecto', { perfilServicio: 'VIP contractual registrado' }, c)).status).toBe(200);
        expect((await patch(p.id, 'proyecto', { perfilServicio: 'VIP contractual registrado' }, c)).status).toBe(200);
        expect((await patch(p.id, 'proyecto', { intruso: 'dato' }, c)).status).toBe(400);
        expect((await patch(p.id, 'edicion', { feedbackTripaEntregaReal: 'fecha incorrecta' }, c)).status).toBe(403);
        const rows = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, p.id));
        expect(rows).toHaveLength(1);
        expect(JSON.stringify(rows[0]?.detalles)).not.toContain('VIP contractual');
        const full = (await get(p.id, 'expediente')).body as ExpedienteFicha;
        expect(full.areas[0]?.fields?.find(f => f.key === 'perfilServicio')?.value).toBe('VIP contractual registrado');
    });
    it('preserva rondas distintas y checklists de calidad en el expediente', async () => {
        const p = await crearProyectoDePrueba();
        const f = await crearFichaTrazabilidad(p.id);
        await db.insert(fichaCalidadFases).values([{ fichaId: f.id, numeroFase: 1, ronda: 1, checklist: { citas: { cumple: false, observaciones: 'Revisar estilo' } } }, { fichaId: f.id, numeroFase: 1, ronda: 2, checklist: { citas: { cumple: true } } }]);
        const full = (await get(p.id, 'expediente')).body as ExpedienteFicha;
        const criteria = full.areas.find(a => a.id === 'calidad')?.fields?.filter(f => f.key.endsWith('.citas'));
        expect(criteria?.map(f => f.value)).toEqual([false, true]);
        expect(full.areas.find(a => a.id === 'calidad')?.fields?.some(f => f.value === 'Revisar estilo')).toBe(true);
    });
    it('pagina actividad por fecha/id sin duplicados y rechaza cursor malformado', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        await db.insert(auditLogs).values(Array.from({ length: 25 }, () => ({ proyectoId: p.id, accion: 'EDITOR_ASIGNADO', entityType: 'proyecto', entityId: p.id, createdAt: new Date('2026-10-09T12:00:00Z') })));
        const first = await get(p.id, 'actividad');
        expect(first.body.items).toHaveLength(20);
        expect(first.body.nextCursor).toBeTruthy();
        const next = await get(p.id, 'actividad?cursor=' + encodeURIComponent(first.body.nextCursor));
        expect(next.body.items).toHaveLength(5);
        expect(next.body.nextCursor).toBeNull();
        expect(new Set([...first.body.items, ...next.body.items].map(i => i.id)).size).toBe(25);
        expect((await get(p.id, 'actividad?cursor=invalido')).status).toBe(400);
        expect(JSON.stringify(first.body)).not.toContain('EDITOR_ASIGNADO');
    });
    it('Impresión valida las cantidades y combina cambios simultáneos sin perder campos', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        const c = await registrarYLoguear(app, 'impresion');
        for (const quantity of [-1, 1.5, '100'])
            expect((await patch(p.id, 'impresion', { cantidadLibros: quantity }, c)).status).toBe(400);
        const results = await Promise.all([patch(p.id, 'impresion', { cantidadLibros: 100 }, c), patch(p.id, 'impresion', { otroMaterialPortada: 'Cartulina' }, c)]);
        expect(results.map(r => r.status)).toEqual([200, 200]);
        const [stored] = await db.select().from(fichaDocumentalDatos).where(eq(fichaDocumentalDatos.proyectoId, p.id));
        expect(stored?.datos).toMatchObject({ cantidadLibros: 100, otroMaterialPortada: 'Cartulina' });
        expect((await patch(p.id, 'distribucion', { nuevoIsbn: '123' }, c)).status).toBe(403);
    });
    it('Distribución registra ISBN por su rol y conserva auditoría sin duplicar el catálogo contractual', async () => {
        const p = await crearProyectoDePrueba();
        await crearFichaTrazabilidad(p.id);
        const c = await registrarYLoguear(app, 'distribucion');
        expect((await patch(p.id, 'distribucion', { nuevoIsbn: '978-000-123', requiereIsbn: true }, c)).status).toBe(200);
        const full = (await get(p.id, 'expediente')).body as ExpedienteFicha;
        expect(full.areas.find(a => a.id === 'distribucion')?.fields?.find(f => f.key === 'nuevoIsbn')?.value).toBe('978-000-123');
        expect((await patch(p.id, 'impresion', { cantidadLibros: 10 }, c)).status).toBe(403);
        expect((await patch(p.id, 'distribucion', { requiereIsbn: 'Sí' }, c)).status).toBe(400);
    });
});
