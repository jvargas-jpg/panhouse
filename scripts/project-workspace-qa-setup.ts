/** Explicit local QA fixture. Creates one fictitious author/project, never edits existing projects. */
import { randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { eq,and } from 'drizzle-orm';
import { db,pool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import { autores,users,servicios,unidades,presupuestos,proyectos,fichasTrazabilidad,preparacionesProyecto } from '../server/db/schema/index.js';
import { crearProyecto,asignarEspecialista } from '../server/helpers/proyectos.js';
import { hashPassword } from '../server/helpers/password.js';
const privatePath='secrets/project-workspace-qa.local.json',output='docs/evidencias/project-workspaces';
try {
  const url=new URL(env.DATABASE_URL);
  if(env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw new Error('Local Panhouse development DB required');
  const previous=await readFile(privatePath,'utf8').then(JSON.parse,()=>null);
  if(previous){console.log(JSON.stringify({existing:true,projectId:previous.projectId,userId:previous.userId}));}
  else {
    const [manager]=await db.select().from(users).where(and(eq(users.rol,'jefe_area'),eq(users.activo,true))).limit(1);
    const [admin]=await db.select().from(users).where(and(eq(users.rol,'direccion'),eq(users.activo,true))).limit(1);
    const [service]=await db.select().from(servicios).where(eq(servicios.codigo,'EF')).limit(1);
    const [unit]=await db.select().from(unidades).limit(1),[budget]=await db.select().from(presupuestos).limit(1);
    if(!manager||!admin||!service||!unit||!budget)throw new Error('Existing roles/catalogs are required');
    const email='workspace.qa@panhouse.test',password=randomBytes(24).toString('base64url');
    if(await db.query.users.findFirst({where:eq(users.email,email)}))throw new Error('QA account already exists; no password reset');
    const [specialist]=await db.insert(users).values({nombre:'Especialista QA · Workspace Drive',email,rol:'especialista',passwordHash:await hashPassword(password)}).returning();
    const [author]=await db.insert(autores).values({nombre:'QA DRIVE · Autor ficticio',categoria:'Estándar'}).returning();
    const created=await crearProyecto({autorIds:[author!.id],servicioId:service.id,unidadId:unit.id,presupuestoId:budget.id,fechaProgramadaInicio:'2026-10-16'});
    if(!created.ok)throw new Error(created.error);const p=created.proyecto;
    await db.update(proyectos).set({notificadoRrpp:true,notificadoJefatura:true,jefeAreaId:manager.id,tituloDefinitivo:'Proyecto QA · Espacio documental',subtituloDefinitivo:'Validación controlada de Drive'}).where(eq(proyectos.id,p.id));
    await db.update(fichasTrazabilidad).set({matrizDiagnosticoGenerado:true,matrizIngresoGenerado:true,capitulosPactados:'1 a 5',paginasPactadas:'100',condicionesEspeciales:['Ilustraciones','Gráficos']}).where(eq(fichasTrazabilidad.proyectoId,p.id));
    await asignarEspecialista(p.id,specialist!.id,manager.id,{exigirHandoff:true});
    // Deliberately fictitious QA facts/links, never an author's production preparation.
    const now=new Date();await db.insert(preparacionesProyecto).values({proyectoId:p.id,recibidoEn:now,expedienteRevisadoEn:now,primerContactoEn:now,reunionOperativaFecha:now,reunionOperativaRealizada:true,
      grabacionUrl:'https://example.test/qa-grabacion',transcripcionUrl:'https://example.test/qa-transcripcion',minutaUrl:'https://example.test/qa-minuta',cronogramaUrl:'https://example.test/qa-cronograma'});
    await mkdir('secrets',{recursive:true});await mkdir(output,{recursive:true});
    await writeFile(privatePath,JSON.stringify({email,password,userId:specialist!.id,projectId:p.id,projectCode:p.codigo,adminId:admin.id},null,2)+'\n',{flag:'wx',mode:0o600});
    await writeFile(output+'/qa-context.json',JSON.stringify({projectId:p.id,projectCode:p.codigo,authorName:author!.nombre,specialistName:specialist!.nombre,
      service:'EF',conditions:['Ilustraciones','Gráficos'],fictitious:true,existingProjectsModified:false,sharing:'PENDIENTE_VALIDACION'},null,2)+'\n');
    console.log(JSON.stringify({created:true,projectId:p.id,projectCode:p.codigo,userId:specialist!.id,credentialsFile:privatePath}));
  }
}catch{console.error('QA setup stopped. No existing user password or real project was changed.');process.exitCode=1;}
finally{await pool.end();}
