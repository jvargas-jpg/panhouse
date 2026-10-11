/** Read-only audit. Never classifies or repairs historical projects. */
import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { fichasTrazabilidad, proyectos, servicios } from '../server/db/schema/index.js';
try {
  const catalogo = await db.select({ codigo: servicios.codigo, peso: servicios.pesoComplejidad, dias: servicios.plazoDias, interno: servicios.plazoInternoDias, comercial: servicios.plazoComercialDias }).from(servicios);
  const legacy = await db.select({ id: proyectos.id, codigo: proyectos.codigo, estado: proyectos.estado, enviado: proyectos.notificadoJefatura }).from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .leftJoin(fichasTrazabilidad, eq(proyectos.id, fichasTrazabilidad.proyectoId))
    .where(and(eq(servicios.codigo, 'CR'), isNull(fichasTrazabilidad.ingresoServicioSubtipoCrudo)));
  console.log(JSON.stringify({ catalogo, crudoSinSubtipo: legacy, enviadosSinSubtipo: legacy.filter(p => p.enviado).length }, null, 2));
} finally { await pool.end(); }
