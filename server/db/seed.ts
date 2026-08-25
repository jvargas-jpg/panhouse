import { db, pool } from './client.js';
import { presupuestos, servicios, unidades } from './schema/index.js';

const NOMBRES_UNIDADES = [
  'Span House',
  'Academia Origen',
  'ILC',
  'Karen Hoyos',
  'Cuento Express',
  'Maxwell',
  'PanHouse',
];

const NOMBRES_PRESUPUESTOS = ['Plata', 'Oro', 'Platinium'];

// pesoComplejidad respeta el orden confirmado EF > EEC > EET > SE; no
// puede derivarse de plazoDias porque EEC y EET empatan en 150 días.
// Valores de partida (4,3,2,1): el orden está confirmado por el
// negocio, pero la magnitud exacta de la diferencia no. Ajustar según
// el piloto si la carga calculada no se siente realista.
const SERVICIOS = [
  { codigo: 'EF', nombre: 'Escritura fantasma', plazoDias: 180, pesoComplejidad: 4 },
  { codigo: 'EEC', nombre: 'Edición de estilo por capítulo', plazoDias: 150, pesoComplejidad: 3 },
  { codigo: 'EET', nombre: 'Edición de estilo tripa completa', plazoDias: 150, pesoComplejidad: 2 },
  {
    codigo: 'SE',
    nombre: 'Sello editorial',
    plazoInternoDias: 60,
    plazoComercialDias: 90,
    pesoComplejidad: 1,
  },
];

async function main() {
  console.log('Sembrando catálogos base...');

  await db
    .insert(unidades)
    .values(NOMBRES_UNIDADES.map((nombre) => ({ nombre })))
    .onConflictDoNothing();

  await db
    .insert(presupuestos)
    .values(NOMBRES_PRESUPUESTOS.map((nombre) => ({ nombre })))
    .onConflictDoNothing();

  await db.insert(servicios).values(SERVICIOS).onConflictDoNothing();

  console.log('Listo.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error sembrando datos:', err);
  process.exit(1);
});
