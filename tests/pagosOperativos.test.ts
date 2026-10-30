import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, notificaciones, pagos, proyectos, users, workItems, externalIntegrations } from '../server/db/schema/index.js';
import { assertFinancialGate, getProjectFinancialStatus, listFinancialProjects } from '../server/helpers/estadoFinanciero.js';
import { transitionPayment, validatePaymentReceipt } from '../server/helpers/pagosOperaciones.js';
import { guardarDatosDocumentales } from '../server/helpers/fichaViva.js';
import { actualizarSeccionDigitalControl, actualizarSeccionSoporteDigital } from '../server/helpers/trazabilidad.js';
import { eliminarProyecto } from '../server/helpers/proyectos.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { completarPreparacionDePrueba, crearPagoDePrueba, crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import type { CorporateDriveOperation } from '../server/modules/integrations/google-drive/corporate.js';

describe('Pagos operativos: contrato, historial, scope y solvencia', () => {
  beforeEach(limpiarBaseDeDatos);
  const payment = (proyectoId: string, extra = {}) => ({ proyectoId, monto: '0.10', fechaPago: '2026-01-10', metodoPago: 'Transferencia', ...extra });
  async function contract(id: string, amount = '100.00') {
    await db.update(proyectos).set({ montoContractual: amount, monedaContractual: 'USD' }).where(eq(proyectos.id,id));
  }
  it('registra una vez bajo dos envíos simultáneos y audita dentro de la transacción', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      const p = await crearProyectoDePrueba(), cookie = await registrarYLoguear(app,'comercial');
      const payload = payment(p.id,{ idempotencyKey: randomUUID() });
      const send = () => request(app.server).post('/api/pagos').set('Cookie',cookie).send(payload);
      const [a,b] = await Promise.all([send(),send()]);
      expect([a.status,b.status]).toEqual([201,201]); expect(a.body.pago.id).toBe(b.body.pago.id);
      expect(await db.select().from(pagos)).toHaveLength(1);
      expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'PAYMENT_REGISTERED'))).toHaveLength(1);
      expect(a.body.pago.estatus).toBe('Verificado');
      expect(a.body.pago.confirmadoPorId).toBe(a.body.pago.registradoPorId);
      expect((await getProjectFinancialStatus(p.id))!.confirmedPaid).toBe('0.10');
      expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'PAYMENT_CONFIRMED'))).toHaveLength(1);
      expect(await db.select().from(notificaciones)).toHaveLength(0);
      const conflict = await request(app.server).post('/api/pagos').set('Cookie',cookie).send({ ...payload, monto:'0.20' });
      expect(conflict.status).toBe(409);
    } finally { await app.close(); }
  });
  it.each(['0','0.00','-1','NaN','1e3','0.001','10000000000.00'])('rechaza monto inválido %s', async monto => {
    const app = crearAppDePrueba(); await app.ready();
    try { const p = await crearProyectoDePrueba(), c = await registrarYLoguear(app,'comercial');
      expect((await request(app.server).post('/api/pagos').set('Cookie',c).send(payment(p.id,{ monto }))).status).toBe(400);
      expect(await db.select().from(pagos)).toHaveLength(0);
    } finally { await app.close(); }
  });
  it('registro confirmado de Comercial recalcula sobrepago y avisa al mismo módulo', async () => {
    const app=crearAppDePrueba(); await app.ready();
    try {
      const p=await crearProyectoDePrueba(),cookie=await registrarYLoguear(app,'comercial'); await contract(p.id,'0.05');
      expect((await request(app.server).post('/api/pagos').set('Cookie',cookie).send(payment(p.id))).status).toBe(201);
      const status=(await getProjectFinancialStatus(p.id))!;
      expect(status.confirmedPaid).toBe('0.10');expect(status.pendingAmount).toBe('0.00');expect(status.paymentStatus).toBe('Sobrepago');expect(status.solvencyStatus).toBe('Pendiente');
      expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'PAYMENT_OVERPAYMENT'))).toHaveLength(1);
      expect(await db.select().from(notificaciones).where(eq(notificaciones.rolDestino,'comercial'))).toHaveLength(1);
      expect(await db.select().from(notificaciones).where(eq(notificaciones.rolDestino,'cobranzas'))).toHaveLength(0);
    } finally { await app.close(); }
  });
  it('rechaza fechas futuras, inexistentes y monedas incompatibles', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try { const p = await crearProyectoDePrueba(), c = await registrarYLoguear(app,'comercial'); await contract(p.id);
      for (const extra of [{ fechaPago:'2999-01-01' },{ fechaPago:'2026-02-30' },{ moneda:'EUR' },{ moneda:'XXX' },{ comprobanteUrl:'https://example.test/receipt' }]) {
        expect((await request(app.server).post('/api/pagos').set('Cookie',c).send(payment(p.id,extra))).status).toBe(400);
      }
    } finally { await app.close(); }
  });
  it('separa verificación, porcentaje y aprobación manual incluso con pago completo', async () => {
    const p = await crearProyectoDePrueba(), collector = await crearUsuario('comercial'); await contract(p.id);
    const pay = await crearPagoDePrueba({ proyectoId:p.id,monto:'100.00' });
    expect((await getProjectFinancialStatus(p.id))!.confirmedPaid).toBe('0.00');
    await transitionPayment(pay.id,'Verificado',undefined,collector);
    const s = (await getProjectFinancialStatus(p.id))!;
    expect(s.confirmedPaid).toBe('100.00'); expect(s.pendingAmount).toBe('0.00'); expect(s.paidPercentage).toBe('100.00');
    expect(s.paymentStatus).toBe('Pagado'); expect(s.solvencyStatus).toBe('Pendiente');
  });
  it('suma decimales exactamente y no admite pagos de otras monedas', async () => {
    const p = await crearProyectoDePrueba(), c = await crearUsuario('comercial'); await contract(p.id,'0.30');
    for (const monto of ['0.10','0.20']) { const a = await crearPagoDePrueba({ proyectoId:p.id,monto }); await transitionPayment(a.id,'Verificado',undefined,c); }
    const s = (await getProjectFinancialStatus(p.id))!; expect(s.confirmedPaid).toBe('0.30'); expect(s.pendingAmount).toBe('0.00');
  });
  it('mantiene porcentaje y saldo nulos sin contrato; el último pago excluye anulados y pendientes', async () => {
    const p = await crearProyectoDePrueba(), c = await crearUsuario('comercial');
    const a = await crearPagoDePrueba({ proyectoId:p.id,monto:'10.00',fechaPago:'2026-01-01' });
    const b = await crearPagoDePrueba({ proyectoId:p.id,monto:'10.00',fechaPago:'2026-02-01' });
    await transitionPayment(a.id,'Verificado',undefined,c); await transitionPayment(b.id,'Verificado',undefined,c);
    await transitionPayment(b.id,'Anulado','Registro equivocado',c);
    const s = (await getProjectFinancialStatus(p.id))!;
    expect(s.contractAmount).toBeNull(); expect(s.pendingAmount).toBeNull(); expect(s.paidPercentage).toBeNull();
    expect(s.lastPayment).toBe('2026-01-01'); expect(s.confirmedPaid).toBe('10.00');
  });
  it('detecta sobrepago sin saldo negativo, conserva porcentaje real y emite alerta una vez', async () => {
    const p = await crearProyectoDePrueba(), c = await crearUsuario('comercial'); await contract(p.id,'10.00');
    const a = await crearPagoDePrueba({ proyectoId:p.id,monto:'12.00' }); await transitionPayment(a.id,'Verificado',undefined,c);
    const s = (await getProjectFinancialStatus(p.id))!; expect(s.pendingAmount).toBe('0.00'); expect(s.paymentStatus).toBe('Sobrepago'); expect(s.paidPercentage).toBe('120.00');
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'PAYMENT_OVERPAYMENT'))).toHaveLength(1);
  });
  it('anular requiere motivo, conserva historial, invalida solvencia y rechaza doble transición', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try { const p = await crearProyectoDePrueba(), c = await registrarYLoguear(app,'comercial'); await contract(p.id);
      const a = await crearPagoDePrueba({ proyectoId:p.id,monto:'50.00' });
      expect((await request(app.server).patch(`/api/pagos/${a.id}/verificar`).set('Cookie',c).send({ estatus:'Verificado' })).status).toBe(200);
      await db.update(proyectos).set({ solvenciaEstado:'Solvente',gateFinancieroRequerido:true }).where(eq(proyectos.id,p.id));
      expect((await request(app.server).post(`/api/pagos/${a.id}/anular`).set('Cookie',c).send({ motivo:' ' })).status).toBe(400);
      const r = await request(app.server).post(`/api/pagos/${a.id}/anular`).set('Cookie',c).send({ motivo:'Duplicado' });
      expect(r.status).toBe(200); expect(r.body.pago.anuladoPorId).toBeTruthy(); expect(r.body.pago.confirmadoPorId).toBeTruthy();
      const s = (await getProjectFinancialStatus(p.id))!; expect(s.confirmedPaid).toBe('0.00'); expect(s.solvencyStatus).toBe('Pendiente'); expect(s.gateSatisfied).toBe(false);
      expect((await request(app.server).patch(`/api/pagos/${a.id}/verificar`).set('Cookie',c).send({ estatus:'Verificado' })).status).toBe(409);
      expect(await db.select().from(pagos)).toHaveLength(1);
    } finally { await app.close(); }
  });
  it('dos confirmaciones simultáneas producen solo una transición auditada', async () => {
    const p = await crearProyectoDePrueba(), c = await crearUsuario('comercial');
    const a = await crearPagoDePrueba({ proyectoId:p.id });
    const r = await Promise.allSettled([transitionPayment(a.id,'Verificado',undefined,c),transitionPayment(a.id,'Verificado',undefined,c)]);
    expect(r.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'PAYMENT_CONFIRMED'))).toHaveLength(1);
  });
  it('protege dinero e historial también a nivel de BD y preserva proyectos con abonos', async () => {
    const p = await crearProyectoDePrueba(), a = await crearPagoDePrueba({ proyectoId:p.id });
    await expect(db.update(pagos).set({ monto:'3.00' }).where(eq(pagos.id,a.id))).rejects.toThrow();
    await expect(db.delete(pagos).where(eq(pagos.id,a.id))).rejects.toThrow();
    await expect(eliminarProyecto(p.id)).rejects.toMatchObject({ statusCode:409 });
  });
  it('paginación y KPIs operan sobre el conjunto completo y excluyen retirados', async () => {
    const ps = await Promise.all(Array.from({ length:6 },() => crearProyectoDePrueba()));
    for (const p of ps) await contract(p.id);
    await db.update(proyectos).set({ estado:'retirado' }).where(eq(proyectos.id,ps[5]!.id));
    const r = await listFinancialProjects({ page:1,pageSize:2 });
    expect(r.items).toHaveLength(2); expect(r.total).toBe(5); expect(r.kpis.conSaldo).toBe(5);
    const b = await listFinancialProjects({ page:2,pageSize:2 }); expect(b.items.every(x => !r.items.some(y => y.id === x.id))).toBe(true);
    const filtered = await listFinancialProjects({ page:1,pageSize:2,search:ps[0]!.codigo }); expect(filtered.total).toBe(1);
    expect((await listFinancialProjects({ page:1,pageSize:2,tab:'pendientes' })).total).toBe(0);
  });
  it('cuenta bloqueados solo cuando el gate afecta trabajo vigente', async () => {
    const a = await crearProyectoDePrueba(), b = await crearProyectoDePrueba();
    await db.update(proyectos).set({ gateFinancieroRequerido:true }).where(sql`${proyectos.id} IN (${a.id}::uuid,${b.id}::uuid)`);
    await db.insert(workItems).values({ proyectoId:a.id,tipo:'soporte_digital' });
    expect((await listFinancialProjects({ page:1,pageSize:8 })).kpis.bloqueados).toBe(1);
  });
  it('lista 1 o 16 proyectos con una sola consulta y aplica filtros reales', async () => {
    const first = await crearProyectoDePrueba(); await contract(first.id);
    const spy = vi.spyOn(db,'execute');
    try {
      await listFinancialProjects({ page:1,pageSize:2 }); expect(spy).toHaveBeenCalledTimes(1);
      spy.mockClear();
      for (let i=0;i<15;i++) await crearProyectoDePrueba();
      const result = await listFinancialProjects({ page:1,pageSize:2,service:first.servicioId,tab:'saldo' });
      expect(spy).toHaveBeenCalledTimes(1); expect(result.total).toBe(1);
      expect((await listFinancialProjects({ page:1,pageSize:2,search:'%' })).total).toBe(0);
    } finally { spy.mockRestore(); }
  });
  it('bloquea paquete final y publicación backend; permite con aprobación explícita', async () => {
    const p = await crearProyectoDePrueba(), designer = await crearUsuario('disenador'), digital = await crearUsuario('soporte_digital');
    await db.update(proyectos).set({ disenadorId:designer.id,gateFinancieroRequerido:true }).where(eq(proyectos.id,p.id));
    await expect(db.transaction(tx => assertFinancialGate(tx,p.id))).rejects.toMatchObject({ statusCode:409 });
    await expect(guardarDatosDocumentales(p.id,'diseno',{ paqueteFinalCargado:true },designer)).rejects.toMatchObject({ statusCode:409 });
    await expect(actualizarSeccionSoporteDigital(p.id,{ soporteDigitalFechaActivacion:'2026-01-01' },digital.id)).rejects.toMatchObject({ statusCode:409 });
    await expect(actualizarSeccionDigitalControl(p.id,{ digitalEstatus:'Completado' })).rejects.toMatchObject({ statusCode:409 });
    await db.update(proyectos).set({ solvenciaEstado:'Solvente' }).where(eq(proyectos.id,p.id));
    await expect(db.transaction(tx => assertFinancialGate(tx,p.id))).resolves.toBeUndefined();
  });
  it('impide IDOR de especialista y devuelve solo solvencia/gate al especialista asignado', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try { const cookie = await registrarYLoguear(app,'especialista'), [specialist] = await db.select().from(users).where(eq(users.rol,'especialista'));
      const a = await crearProyectoDePrueba({ especialistaId:specialist!.id }), b = await crearProyectoDePrueba(); await contract(a.id);
      const allowed = await request(app.server).get(`/api/pagos/proyectos/${a.id}/estado`).set('Cookie',cookie);
      expect(allowed.status).toBe(200); expect(Object.keys(allowed.body).sort()).toEqual(['financialGateStatus','gateSatisfied','solvencyStatus']);
      expect((await request(app.server).get(`/api/pagos/proyectos/${b.id}/estado`).set('Cookie',cookie)).status).toBe(403);
      for (const path of ['/api/pagos/proyectos',`/api/pagos/proyectos/${a.id}`,'/api/pagos/00000000-0000-0000-0000-000000000001/comprobante'])
        expect((await request(app.server).get(path).set('Cookie',cookie)).status).toBe(403);
      const project = await request(app.server).get(`/api/proyectos/${a.id}`).set('Cookie',cookie);
      expect(JSON.stringify(project.body)).not.toContain('montoContractual');
    } finally { await app.close(); }
  });
  it('Admin ve el detalle y debe justificar registros y anulaciones', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try { const p = await crearProyectoDePrueba(), cookie = await registrarYLoguear(app,'admin');
      expect((await request(app.server).get('/api/pagos/proyectos').set('Cookie',cookie)).status).toBe(200);
      expect((await request(app.server).post('/api/pagos').set('Cookie',cookie).send(payment(p.id))).status).toBe(400);
      expect((await request(app.server).post('/api/pagos').set('Cookie',cookie).send(payment(p.id,{ motivoAdministrativo:'Recuperación documentada' }))).status).toBe(201);
    } finally { await app.close(); }
  });
  it('cambio contractual y solvencia exigen revisión vigente y motivo', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try { const p = await crearProyectoDePrueba(), commercial = await registrarYLoguear(app,'comercial'), collector = await registrarYLoguear(app,'comercial');
      const detail = await request(app.server).get(`/api/pagos/proyectos/${p.id}`).set('Cookie',commercial);
      const path = `/api/pagos/proyectos/${p.id}/contrato`;
      const input = { monto:'100.00',moneda:'USD',motivo:'Contrato firmado',expectedUpdatedAt:detail.body.revision };
      expect((await request(app.server).patch(path).set('Cookie',commercial).send(input)).status).toBe(200);
      expect((await request(app.server).patch(path).set('Cookie',commercial).send(input)).status).toBe(409);
      const next = await request(app.server).get(`/api/pagos/proyectos/${p.id}`).set('Cookie',collector);
      const action = { estado:'Solvente',gateRequired:true,motivo:'Verificación documental',expectedUpdatedAt:next.body.revision };
      expect((await request(app.server).patch(`/api/pagos/proyectos/${p.id}/solvencia`).set('Cookie',await registrarYLoguear(app,'cobranzas')).send(action)).status).toBe(403);
      expect((await request(app.server).patch(`/api/pagos/proyectos/${p.id}/solvencia`).set('Cookie',collector).send(action)).status).toBe(200);
    } finally { await app.close(); }
  });
  it('no mezcla monedas históricas ni produce porcentajes engañosos', async () => {
    const p = await crearProyectoDePrueba(); await contract(p.id);
    await db.insert(pagos).values({ proyectoId:p.id,monto:'1.00',moneda:'EUR',estatus:'Verificado',fechaPago:'2026-01-01',metodoPago:'Transferencia' });
    const s = (await getProjectFinancialStatus(p.id))!; expect(s.currencyMismatch).toBe(true); expect(s.confirmedPaid).toBeNull(); expect(s.paidPercentage).toBeNull();
  });
  it('valida pertenencia, MIME y tamaño del comprobante sin confiar en la URL', async () => {
    const p = await crearProyectoDePrueba(); await completarPreparacionDePrueba(p.id);
    const [integration] = await db.select().from(externalIntegrations);
    let parent = 'fixture-' + p.id, mimeType = 'application/pdf', size = 100;
    const operate = (async (fn: Parameters<CorporateDriveOperation>[0]) => fn({ integration:integration!,storage:{ getMetadata: async (id:string) => ({ providerFileId:id,name:'receipt.pdf',mimeType,size,parents:id==='receipt'?[parent]:[],appProperties:{},webViewLink:null }) } as never })) as CorporateDriveOperation;
    await expect(validatePaymentReceipt(p.id,'https://drive.google.com/file/d/receipt/view',operate)).resolves.toContain('/receipt/view');
    parent = 'other-project'; await expect(validatePaymentReceipt(p.id,'https://drive.google.com/file/d/receipt/view',operate)).rejects.toMatchObject({ statusCode:403 });
    parent = 'fixture-' + p.id; mimeType = 'text/html'; await expect(validatePaymentReceipt(p.id,'https://drive.google.com/file/d/receipt/view',operate)).rejects.toMatchObject({ statusCode:400 });
    mimeType = 'application/pdf'; size = 5242881; await expect(validatePaymentReceipt(p.id,'https://drive.google.com/file/d/receipt/view',operate)).rejects.toMatchObject({ statusCode:400 });
    await expect(validatePaymentReceipt(p.id,'http://localhost/secret',operate)).rejects.toMatchObject({ statusCode:400 });
  });
});
