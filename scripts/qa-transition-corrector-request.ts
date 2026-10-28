import { db } from '../server/db/client.js';
import { solicitudesArea, users, proyectos } from '../server/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { decidirRequestCorrector } from '../server/helpers/correctorRequests.js';

const action = process.argv[2] as 'return' | 'resolve';
const [r] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.tipo, 'corrector_aclaracion'));
if (!r) { console.log('no request found'); process.exit(1); }
const [project] = await db.select().from(proyectos).where(eq(proyectos.id, r.proyectoId));
const [specialist] = await db.select().from(users).where(eq(users.id, r.targetUserId!));
await decidirRequestCorrector(r.id, specialist!, r.version, action,
  action === 'return' ? 'Indica exactamente a qué nombre propio te refieres en el capítulo tres' : 'Confirmado: usa "Elena" en todo el capítulo tres, es el nombre correcto.');
console.log(action, r.id, 'version was', r.version);
process.exit(0);
