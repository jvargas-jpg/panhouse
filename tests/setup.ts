import { afterAll } from 'vitest';
import { cerrarConexionDb } from './helpers/db.js';

// A diferencia de globalSetup.ts (que corre una sola vez, en un
// proceso aparte, antes de toda la corrida), setupFiles corre una vez
// por cada archivo de test, en el mismo contexto de módulos que ese
// archivo — por eso el pool de conexiones de server/db/client.ts sigue
// siendo uno por archivo (aislamiento intacto), pero ya no depende de
// que cada archivo se acuerde de registrar su propio
// afterAll(cerrarConexionDb): quedaba fácil de duplicar al agregar un
// describe nuevo, y duplicarlo rompía la suite ("Cannot use a pool
// after calling end on the pool").
afterAll(async () => {
  await cerrarConexionDb();
});
