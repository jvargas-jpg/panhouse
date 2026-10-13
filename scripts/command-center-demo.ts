import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { capitulos, proyectos, users, workItems } from '../server/db/schema/index.js';
import { actualizarCapituloAutor, actualizarCapituloEditor } from '../server/helpers/capitulos.js';
import { registrarFeedbackTripa } from '../server/helpers/proyectos.js';
import { solicitarDireccionCreativa, asignarLiderCreativo } from '../server/helpers/direccionCreativa.js';
import { solicitarCorreccion } from '../server/helpers/correcciones.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from '../server/helpers/workItems.js';

const source = new URL(process.env.DATABASE_URL!);
if (!['localhost','127.0.0.1'].includes(source.hostname) || source.pathname !== '/panhouse') throw Error('Solo DEMO local');
const path='docs/demo/jefatura-escenarios.json';
const manifest=JSON.parse(await readFile(path,'utf8'));
const caso=manifest.casos.find((c:{codigo:string})=>c.codigo==='1093A0');
if (!caso) throw Error('Caso DEMO no encontrado');
try {
  const [p]=await db.select().from(proyectos).where(eq(proyectos.id,caso.id));
  if (!p?.tituloDefinitivo?.startsWith('DEMO') || !p.especialistaId || !p.editorId) throw Error('Se requiere caso DEMO con Edición y Especialista');
  const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const cs=await db.select().from(capitulos).where(eq(capitulos.proyectoId,p.id));
  for (const c of cs) { if(!c.fechaEntregaEditor) await actualizarCapituloEditor(p.id,c.numero,{fechaEntregaEditor:hoy}); if(!c.fechaEnvioAutor) await actualizarCapituloAutor(p.id,c.numero,{fechaEnvioAutor:hoy},p.especialistaId); }
  if (!p.fechaFeedbackTripa) await registrarFeedbackTripa(p.id,hoy,p.especialistaId);
  const creative=await solicitarDireccionCreativa(p.id,p.especialistaId);
  if(!creative.ok || !creative.id) throw Error('No se habilitó Creativa');
  const [leader]=await db.select({id:users.id}).from(users).where(and(eq(users.rol,'lider_creativo'),eq(users.activo,true))).limit(1);
  if(!leader || !p.jefeAreaId) throw Error('Falta líder creativo / Jefatura');
  const assigned=await asignarLiderCreativo(creative.id,leader.id,p.jefeAreaId);if(!assigned.ok)throw Error(assigned.error);
  await solicitarCorreccion(p.id,{alcance:'tripa_completa',paginas:80},p.especialistaId);
  await db.transaction(async tx=>{ const id=await crearWorkItemSiNoExiste(tx,{proyectoId:p.id,tipo:'edicion',businessKey:'revision-adicional-demo',observaciones:'DEMO: ronda adicional de Edición en paralelo a Creativa y Corrección.'});await transicionarWorkItemPorId(tx,id,'en_progreso'); });
  caso.escenario='Paralelo: Edición adicional + Creativa activa + Corrección pendiente + Lanzamiento habilitado';
  await writeFile(path,JSON.stringify(manifest,null,2));
  const trabajos=await db.select({tipo:workItems.tipo,estado:workItems.estado}).from(workItems).where(eq(workItems.proyectoId,p.id));
  console.log(JSON.stringify({codigo:p.codigo,escenario:caso.escenario,trabajos}));
} finally {await pool.end();}
