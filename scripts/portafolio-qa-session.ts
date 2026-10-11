// Read-only inspection of development projects; only creates a normal login session.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { obtenerPortafolioJefatura } from '../server/helpers/jefaturaProyectos.js';
try {
  const [jefe] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.rol, 'jefe_area'), eq(users.activo, true)))
    .limit(1);
  if (!jefe) throw new Error('No active Jefatura account for QA');
  const session = await createSession(jefe.id);
  await writeFile(
    join(tmpdir(), 'panhouse-browser-qa', 'state.json'),
    JSON.stringify({
      cookies: [
        {
          name: 'panhouse_sid',
          value: session,
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );
  const portfolio = await obtenerPortafolioJefatura({
    tab: 'todos',
    q: '',
    orden: 'urgentes',
    page: 1,
    pageSize: 20,
  });
  console.log(
    JSON.stringify({
      counts: portfolio.counts,
      items: portfolio.items.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        porAsignar: p.porAsignar,
        especialista: !!p.especialista,
        riesgo: p.riesgo.atencion,
        express: p.express.estado,
        crudo: p.subtipoCrudo,
        estado: p.estado,
      })),
    }),
  );
} finally {
  await pool.end();
}
