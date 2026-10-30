import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { auditLogs, proyectos } from '../server/db/schema/index.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearServicio, crearUnidad } from './helpers/fixtures.js';
import { registrarYLoguear } from './helpers/auth.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Monto total al crear el proyecto y porcentaje financiero',()=>{
  beforeEach(limpiarBaseDeDatos);
  async function setup(){
    const app=crearAppDePrueba();await app.ready();
    const cookie=await registrarYLoguear(app,'comercial');
    const [autor,unidad,presupuesto]=await Promise.all([crearAutor(),crearUnidad(),crearPresupuesto()]);
    const servicio=await crearServicio({codigo:'EF',nombre:'Escritura fantasma',pesoComplejidad:4,plazoDias:180});
    return {app,cookie,body:{autorIds:[autor.id],servicioId:servicio.id,unidadId:unidad.id,presupuestoId:presupuesto.id,fechaProgramadaInicio:'2026-01-01'}};
  }
  it('persiste y audita el monto real desde el alta; pagos y cambios de total recalculan saldo y porcentaje',async()=>{
    const {app,cookie,body}=await setup();
    try{
      const created=await request(app.server).post('/api/proyectos').set('Cookie',cookie).send({...body,montoContractual:'1000',monedaContractual:'USD'});
      expect(created.status).toBe(201);expect(created.body.proyecto.montoContractual).toBe('1000.00');expect(created.body.proyecto.monedaContractual).toBe('USD');
      const id=created.body.proyecto.id;
      const events=await db.select().from(auditLogs).where(eq(auditLogs.proyectoId,id));
      expect(events).toHaveLength(1);expect(events[0]!.accion).toBe('CONTRACT_AMOUNT_CHANGED');expect(events[0]!.actorId).toBeTruthy();
      const first=await request(app.server).get(`/api/pagos/proyectos/${id}`).set('Cookie',cookie);
      expect(first.body.pendingAmount).toBe('1000.00');expect(first.body.paidPercentage).toBe('0.00');
      for(const monto of ['250.00','100.00']) expect((await request(app.server).post('/api/pagos').set('Cookie',cookie).send({proyectoId:id,monto,moneda:'USD',fechaPago:'2026-01-10',metodoPago:'Transferencia'})).status).toBe(201);
      const paid=await request(app.server).get(`/api/pagos/proyectos/${id}`).set('Cookie',cookie);
      expect(paid.body.confirmedPaid).toBe('350.00');expect(paid.body.pendingAmount).toBe('650.00');expect(paid.body.paidPercentage).toBe('35.00');expect(paid.body.solvencyStatus).toBe('Pendiente');
      expect((await request(app.server).patch(`/api/pagos/proyectos/${id}/contrato`).set('Cookie',cookie).send({monto:'2000.00',moneda:'USD',motivo:'Ampliación acordada',expectedUpdatedAt:paid.body.revision})).status).toBe(200);
      const changed=await request(app.server).get(`/api/pagos/proyectos/${id}`).set('Cookie',cookie);
      expect(changed.body.confirmedPaid).toBe('350.00');expect(changed.body.pendingAmount).toBe('1650.00');expect(changed.body.paidPercentage).toBe('17.50');
    }finally{await app.close();}
  });
  it.each([
    {montoContractual:'0',monedaContractual:'USD'},
    {montoContractual:'-1',monedaContractual:'USD'},
    {montoContractual:'0.001',monedaContractual:'USD'},
    {montoContractual:'10000000000',monedaContractual:'USD'},
    {montoContractual:'10',monedaContractual:'XXX'},
    {montoContractual:'10',monedaContractual:'JPY'},
    {montoContractual:'10'},
    {monedaContractual:'USD'},
  ])('rechaza importe/moneda inválidos sin crear un proyecto: %j',async fields=>{
    const {app,cookie,body}=await setup();
    try{
      expect((await request(app.server).post('/api/proyectos').set('Cookie',cookie).send({...body,...fields})).status).toBe(400);
      expect(await db.select().from(proyectos)).toHaveLength(0);expect(await db.select().from(auditLogs)).toHaveLength(0);
    }finally{await app.close();}
  });
  it('los clientes anteriores pueden omitir el contrato sin inventar importe ni porcentaje',async()=>{
    const {app,cookie,body}=await setup();
    try{
      const created=await request(app.server).post('/api/proyectos').set('Cookie',cookie).send(body);expect(created.status).toBe(201);
      const detail=await request(app.server).get(`/api/pagos/proyectos/${created.body.proyecto.id}`).set('Cookie',cookie);
      expect(detail.body.contractAmount).toBeNull();expect(detail.body.currency).toBeNull();expect(detail.body.paidPercentage).toBeNull();
    }finally{await app.close();}
  });
});
