/** Explicit local QA fixture: leaves project unassigned. Assignment MUST happen in Jefatura UI. */
import { randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { and,eq } from 'drizzle-orm';
import { db,pool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import { autores,users,servicios,unidades,presupuestos,proyectos,fichasTrazabilidad } from '../server/db/schema/index.js';
import { crearProyecto,notificarRrppProyectoBase,notificarJefaturaFichaCompletada } from '../server/helpers/proyectos.js';
import { hashPassword } from '../server/helpers/password.js';
const privatePath='secrets/project-workspace-assignment-qa.local.json';
try{
  const url=new URL(env.DATABASE_URL);
  if(env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw Error('Local development DB required');
  const previous=await readFile(privatePath,'utf8').then(JSON.parse,()=>null);
  if(previous)console.log(JSON.stringify({existing:true,projectId:previous.projectId}));
  else{
    const identities=[];
    for(const rol of ['jefe_area','especialista','rrpp','comercial'] as const){
      const password=randomBytes(24).toString('base64url'),email=`workspace.assignment.qa.${rol}@panhouse.test`;
      if(await db.query.users.findFirst({where:eq(users.email,email)}))throw Error('QA identity already exists; no password reset');
      const [user]=await db.insert(users).values({nombre:`QA Auto Drive · ${rol}`,email,rol,passwordHash:await hashPassword(password)}).returning();
      identities.push({id:user!.id,rol,email,password});
    }
    const [service]=await db.select().from(servicios).where(eq(servicios.codigo,'EF'));
    const [unit]=await db.select().from(unidades).limit(1),[budget]=await db.select().from(presupuestos).limit(1);
    if(!service||!unit||!budget)throw Error('Catalogs required');
    const [author]=await db.insert(autores).values({nombre:'QA AUTO DRIVE · Autor ficticio',categoria:'Estándar'}).returning();
    const result=await crearProyecto({autorIds:[author!.id],servicioId:service.id,unidadId:unit.id,presupuestoId:budget.id,fechaProgramadaInicio:'2026-10-19'});
    if(!result.ok)throw Error(result.error);const p=result.proyecto;
    await db.update(proyectos).set({jefeAreaId:identities[0]!.id,tituloDefinitivo:'QA · Asignación automática Drive'}).where(eq(proyectos.id,p.id));
    await db.update(fichasTrazabilidad).set({ingresoFechaIngreso:'2026-10-19',ingresoServicioEjecucion:'Normal',ingresoServicioAlianza:false,
      matrizDiagnosticoGenerado:true,matrizIngresoGenerado:true,capitulosPactados:'1 a 5',paginasPactadas:'100',condicionesEspeciales:['Ilustraciones','Gráficos']}).where(eq(fichasTrazabilidad.proyectoId,p.id));
    for(const handoff of [await notificarRrppProyectoBase(p.id,identities[3]!.id),await notificarJefaturaFichaCompletada(p.id,identities[2]!.id)])if(!handoff.ok)throw Error(handoff.error);
    await mkdir('secrets',{recursive:true});
    await writeFile(privatePath,JSON.stringify({projectId:p.id,projectCode:p.codigo,identities},null,2),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({created:true,projectId:p.id,projectCode:p.codigo,assigned:false,workspaceCreated:false}));
  }
}catch(error){console.error(error instanceof Error?error.message:'QA setup failed');process.exitCode=1;}
finally{await pool.end();}
