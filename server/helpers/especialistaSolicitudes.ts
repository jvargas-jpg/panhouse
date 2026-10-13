import { pool, db } from '../db/client.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { auditLogs, contratosCorreccion, informacionContrato, users, direccionesCreativas, fichaCalidadFases, fichasTrazabilidad, correcciones, informacionSolicitudArea, solicitudesArea } from '../db/schema/index.js';
import { ErrorFichaViva } from './fichaViva.js';
import { etiquetaEventoFicha } from './fichaViva.js';
import type { Rol } from '../db/schema/index.js';
import type { DetalleSolicitud, FiltrosSolicitudes, SolicitudOperativa, SolicitudesEspecialista, TipoSolicitud } from '../../shared/especialistaSolicitudes.js';
type Actor = {id:string;rol:Rol};
export const TIPOS_SOLICITUD: {tipo:TipoSolicitud;nombre:string;rol:string;destino:string}[] = [
  {tipo:'editor',nombre:'Asignación de Editor',rol:'jefe_edicion',destino:'Jefatura de Edición'},
  {tipo:'creativa',nombre:'Reunión creativa',rol:'lider_creativo',destino:'Líder Creativo'},
  {tipo:'contrato',nombre:'Contrato de corrección',rol:'talento_humano',destino:'Talento Humano'},
  {tipo:'calidad',nombre:'Validación de versión',rol:'soporte_editorial',destino:'Soporte Editorial'},
  {tipo:'digital',nombre:'Activación Amazon',rol:'soporte_digital',destino:'Soporte Digital'},
  {tipo:'lanzamiento',nombre:'Planificación de lanzamiento',rol:'rrpp',destino:'RRPP'},
  {tipo:'impresion',nombre:'Coordinación de impresión',rol:'rrpp',destino:'RRPP'},
];
// Read projection of native requests, not a second lifecycle for their processes.
// Scope is materialized before any related source reads; assignment history wins over stale FK.
const FUENTES = `WITH scope AS MATERIALIZED (
 SELECT p.*, coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') titulo_actual,
 coalesce((SELECT string_agg(a.nombre, ', ' ORDER BY a.nombre) FROM proyectos_autores pa JOIN autores a ON a.id=pa.autor_id WHERE pa.proyecto_id=p.id),a.nombre) autores,
 s.nombre servicio_nombre FROM proyectos p JOIN autores a ON a.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
 WHERE ($2::text IN ('talento_humano','rrpp') OR coalesce(
 (SELECT usuario_id FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='especialista' AND x.work_item_id IS NULL AND x.finalizado_en IS NULL ORDER BY asignado_en DESC,id DESC LIMIT 1),
 CASE WHEN NOT EXISTS(SELECT 1 FROM project_assignments h WHERE h.proyecto_id=p.id AND h.tipo='especialista' AND h.work_item_id IS NULL) THEN p.especialista_id END)=$1::uuid)
), native AS (
 SELECT wi.id, p.id proyecto_id, wi.id work_item_id, wi.business_key, 'editor'::text tipo, 'edicion'::text proceso,
 CASE WHEN wi.estado='cancelado' THEN 'cancelada' WHEN ae.id IS NOT NULL THEN 'resuelta' ELSE 'pendiente' END estado,
 pedido.created_at requested_at, ae.asignado_en::text resolved_at, CASE WHEN ae.id IS NOT NULL THEN 'Editor asignado: '||ae.nombre END outcome
 FROM scope p JOIN work_items wi ON wi.proyecto_id=p.id AND wi.tipo='edicion'
 JOIN LATERAL (SELECT min(created_at) created_at FROM audit_logs WHERE entity_id=wi.id AND accion='EDITOR_SOLICITADO') pedido ON pedido.created_at IS NOT NULL
 LEFT JOIN LATERAL (SELECT x.id,x.asignado_en,u.nombre FROM project_assignments x JOIN usuarios u ON u.id=x.usuario_id WHERE x.proyecto_id=p.id AND x.tipo='editor' AND x.work_item_id IS NULL AND x.asignado_en>=pedido.created_at ORDER BY x.asignado_en,x.id LIMIT 1) ae ON true
 UNION ALL
 SELECT c.work_item_id,p.id,c.work_item_id,wi.business_key,'creativa','direccion_creativa',
 CASE WHEN wi.estado='cancelado' THEN 'cancelada' WHEN c.reunion_realizada THEN 'resuelta' WHEN wi.estado='en_progreso' THEN 'en_revision' ELSE 'pendiente' END,
 c.created_at,CASE WHEN c.reunion_realizada THEN c.fecha_reunion::text END,CASE WHEN c.reunion_realizada THEN 'Reunión creativa realizada' END
 FROM scope p JOIN direcciones_creativas c ON c.proyecto_id=p.id AND c.tipo='concepto_portada' JOIN work_items wi ON wi.id=c.work_item_id
 UNION ALL
 SELECT r.id,p.id,c.work_item_id,'contrato:'||c.id::text||':'||r.ronda::text,'contrato','correccion',r.estado,r.requested_at,r.resolved_at::text,
 CASE WHEN r.estado='resuelta' THEN 'Contrato confirmado para '||r.corrector_nombre WHEN r.estado='rechazada' THEN r.motivo END
 FROM scope p JOIN correcciones c ON c.proyecto_id=p.id JOIN contratos_correccion r ON r.correccion_id=c.id
 UNION ALL
 SELECT q.work_item_id,p.id,q.work_item_id,wi.business_key,'calidad','calidad',
 CASE WHEN wi.estado='cancelado' THEN 'cancelada' WHEN q.revisado_en IS NOT NULL THEN 'resuelta' WHEN q.iniciado_en IS NOT NULL THEN 'en_revision' ELSE 'pendiente' END,
 q.solicitado_en,q.revisado_en::text,CASE WHEN q.revisado_en IS NOT NULL THEN CASE WHEN q.aprobado THEN 'Versión aprobada por Calidad' ELSE 'Comentarios entregados a Diseño' END END
 FROM scope p JOIN fichas_trazabilidad f ON f.proyecto_id=p.id JOIN ficha_calidad_fases q ON q.ficha_id=f.id JOIN work_items wi ON wi.id=q.work_item_id WHERE q.solicitado_en IS NOT NULL
 UNION ALL
 SELECT wi.id,p.id,wi.id,wi.business_key,'digital','soporte_digital',
 CASE WHEN wi.estado='cancelado' THEN 'cancelada' WHEN f.soporte_digital_fecha_activacion IS NOT NULL THEN 'resuelta' WHEN wi.estado='en_progreso' THEN 'en_revision' ELSE 'pendiente' END,
 wi.created_at,f.soporte_digital_fecha_activacion::text,CASE WHEN f.soporte_digital_fecha_activacion IS NOT NULL THEN 'Activación Amazon registrada' END
 FROM scope p JOIN work_items wi ON wi.proyecto_id=p.id AND wi.tipo='soporte_digital' AND wi.business_key='activacion_amazon' LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id
 UNION ALL
 SELECT r.id,p.id,r.work_item_id,r.business_key,r.tipo,r.tipo,r.estado,r.requested_at,r.resolved_at::text,coalesce(r.outcome,r.motivo)
 FROM scope p JOIN solicitudes_area r ON r.proyecto_id=p.id
), requests AS (
 SELECT n.*,p.codigo,p.titulo_actual,p.autores,p.servicio_nombre,p.fecha_fin_proyectada,p.subtitulo_definitivo FROM native n JOIN scope p ON p.id=n.proyecto_id
 WHERE ($2::text<>'talento_humano' OR n.tipo='contrato') AND ($2::text<>'rrpp' OR n.tipo IN ('lanzamiento','impresion'))
)`;
interface Fila { id:string; proyecto_id:string; work_item_id:string; business_key:string; tipo:TipoSolicitud; proceso:string; estado:SolicitudOperativa['estado']; requested_at:Date; resolved_at:string|null; outcome:string|null; codigo:string; titulo_actual:string; autores:string; servicio_nombre:string; fecha_fin_proyectada:string|null; subtitulo_definitivo:string|null }
function dto(r: Fila): SolicitudOperativa {
  const tipo = TIPOS_SOLICITUD.find(t=>t.tipo===r.tipo)!;
  return {id:r.id,tipo:r.tipo,titulo:tipo.nombre,proyecto:{id:r.proyecto_id,codigo:r.codigo,titulo:r.titulo_actual,autores:r.autores,servicio:r.servicio_nombre,portadaUrl:null,fechaObjetivo:r.fecha_fin_proyectada},proceso:r.proceso,workItemId:r.work_item_id,businessKey:r.business_key,destino:{rol:tipo.rol,nombre:tipo.destino},estado:r.estado,requestedAt:r.requested_at.toISOString(),resolvedAt:r.resolved_at ? (/^\d{4}-\d{2}-\d{2}$/.test(r.resolved_at)?r.resolved_at:new Date(r.resolved_at).toISOString()) : null,outcome:r.outcome==='LANZAMIENTO_ACTIVADO'?'RRPP inició la planificación':r.outcome==='IMPRESION_ACTIVADA'?'RRPP inició la coordinación de Impresión':r.outcome,requiresUserAction:r.estado==='requiere_informacion'};
}
export async function listarSolicitudes(actor: Actor, f: FiltrosSolicitudes, ahora = new Date()): Promise<SolicitudesEspecialista> {
  if (!['especialista','talento_humano','rrpp'].includes(actor.rol)) throw new ErrorFichaViva(403,'No autorizado para Solicitudes');
  const args:unknown[]=[actor.id,actor.rol], where:string[]=[];
  const bind=(v:unknown)=>{args.push(v);return '$'+args.length;};
  if(f.tipo)where.push('tipo='+bind(f.tipo));
  if(f.destino){const tipos=TIPOS_SOLICITUD.filter(t=>t.rol===f.destino).map(t=>t.tipo);where.push('tipo=ANY('+bind(tipos)+'::text[])');}
  if(f.estado)where.push('estado='+bind(f.estado));
  if(f.proyecto)where.push('proyecto_id='+bind(f.proyecto)+'::uuid');
  if(f.desde)where.push("(requested_at AT TIME ZONE 'America/Caracas')::date >= "+bind(f.desde)+'::date');
  if(f.hasta)where.push("(requested_at AT TIME ZONE 'America/Caracas')::date <= "+bind(f.hasta)+'::date');
  if(f.search)where.push("translate(lower(titulo_actual||' '||autores||' '||codigo||' '||CASE tipo WHEN 'editor' THEN 'Asignación de Editor' WHEN 'creativa' THEN 'Reunión creativa' WHEN 'contrato' THEN 'Contrato de corrección' WHEN 'calidad' THEN 'Validación de versión' WHEN 'digital' THEN 'Activación Amazon' WHEN 'impresion' THEN 'Coordinación de impresión' ELSE 'Planificación de lanzamiento' END),'áéíóúüñ','aeiouun') LIKE "+bind('%'+f.search.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[\\%_]/g,'\\$&')+'%'));
  const condition=where.length?where.join(' AND '):'true';
  const bucket=f.tab==='abiertas'?"estado IN ('pendiente','en_revision','requiere_informacion')":f.tab==='informacion'?"estado='requiere_informacion'":f.tab==='resueltas'?"estado IN ('resuelta','rechazada','cancelada')":'true';
  const size=bind(f.pageSize),page=bind(f.page);
  const {rows}=await pool.query<{result:SolicitudesEspecialista}>(`${FUENTES}, filtered AS(SELECT * FROM requests WHERE ${condition}), selected AS(SELECT * FROM filtered WHERE ${bucket}), meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages FROM selected), paged AS(SELECT * FROM selected ORDER BY (estado='requiere_informacion') DESC,requested_at DESC,id LIMIT ${size} OFFSET ((SELECT least(${page},pages)-1 FROM meta)*${size})) SELECT json_build_object('rows',coalesce((SELECT json_agg(row_to_json(paged)) FROM paged),'[]'::json),'total',m.total,'pages',m.pages,'page',least(${page},m.pages),'summary',(SELECT json_build_object('abiertas',count(*) FILTER(WHERE estado IN ('pendiente','en_revision','requiere_informacion')),'revision',count(*) FILTER(WHERE estado='en_revision'),'informacion',count(*) FILTER(WHERE estado='requiere_informacion'),'resueltas',count(*) FILTER(WHERE estado='resuelta')) FROM filtered),'projects',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT id,titulo_actual titulo FROM scope ORDER BY titulo_actual,id) x)) result FROM meta m`,args);
  const raw=rows[0]!.result as unknown as {rows:(Omit<Fila,'requested_at'>&{requested_at:string})[];total:number;pages:number;page:number;summary:SolicitudesEspecialista['resumen'];projects:{id:string;titulo:string}[]};
  return {actualizadoEn:ahora.toISOString(),solicitudes:raw.rows.map(r=>dto({...r,requested_at:new Date(r.requested_at)})),total:raw.total,pages:raw.pages,page:raw.page,pageSize:f.pageSize,resumen:raw.summary,catalogos:{tipos:TIPOS_SOLICITUD.filter(t=>(actor.rol!=='talento_humano'||t.tipo==='contrato')&&(actor.rol!=='rrpp'||t.rol==='rrpp')).map(t=>({tipo:t.tipo,nombre:t.nombre})),destinos:TIPOS_SOLICITUD.filter(t=>(actor.rol!=='talento_humano'||t.tipo==='contrato')&&(actor.rol!=='rrpp'||t.rol==='rrpp')).map(t=>({rol:t.rol,nombre:t.destino})),proyectos:raw.projects}};
}
const EVENTOS_CONTRATO:Record<string,string>={CONTRATO_CORRECCION_SOLICITADO:'Solicitud de contrato enviada',CONTRATO_REVISION_INICIADA:'Talento inició la revisión',CONTRATO_INFORMACION_SOLICITADA:'Talento solicitó información adicional',CONTRATO_INFORMACION_RESPONDIDA:'El Especialista respondió',CONTRATO_CONFIRMADO:'Talento confirmó la recepción del contrato firmado',CONTRATO_RECHAZADO:'Talento rechazó la solicitud'};
export async function detalleSolicitud(id:string,actor:Actor):Promise<DetalleSolicitud> {
  if(!['especialista','talento_humano','rrpp'].includes(actor.rol))throw new ErrorFichaViva(403,'No autorizado');
  const {rows}=await pool.query<Fila>(`${FUENTES} SELECT * FROM requests WHERE id=$3::uuid`,[actor.id,actor.rol,id]);
  if(!rows[0])throw new ErrorFichaViva(404,'Solicitud no encontrada o fuera de tu ámbito');
  const r=rows[0], result=dto(r), contexto=[{label:'Servicio',value:r.servicio_nombre},{label:'Destino',value:result.destino.nombre}];
  const enlaces:DetalleSolicitud['enlaces']=[];
  let pregunta:DetalleSolicitud['pregunta']=null;
  let version: number | undefined;
  let relatedIds=[id];
  let eventTypes:string[]=[];
  if(r.tipo==='lanzamiento'||r.tipo==='impresion') {
    const [native]=await db.select({version:solicitudesArea.version}).from(solicitudesArea).where(eq(solicitudesArea.id,id));
    version=native?.version;
    const [q]=await db.select({q:informacionSolicitudArea,actor:users.nombre}).from(informacionSolicitudArea).leftJoin(users,eq(users.id,informacionSolicitudArea.askedById)).where(eq(informacionSolicitudArea.solicitudId,id)).orderBy(desc(informacionSolicitudArea.askedAt),desc(informacionSolicitudArea.id)).limit(1);
    if(q)pregunta={id:q.q.id,texto:q.q.pregunta,actor:q.actor ?? 'RRPP',fecha:q.q.askedAt.toISOString(),respuesta:q.q.respuesta,respondidaEn:q.q.answeredAt?.toISOString() ?? null};
    eventTypes=['SOLICITUD_AREA_CREADA','SOLICITUD_AREA_ACTUALIZADA','SOLICITUD_AREA_ACTIVADA'];
  } else if(r.tipo==='contrato') {
    const [c]=await db.select({contrato:contratosCorreccion,correccion:correcciones}).from(contratosCorreccion).innerJoin(correcciones,eq(correcciones.id,contratosCorreccion.correccionId)).where(eq(contratosCorreccion.id,id));
    contexto.push({label:'Corrector freelance',value:c!.contrato.correctorNombre},{label:'Intervención',value:c!.correccion.alcance.replaceAll('_',' ')},{label:'Ronda contractual',value:String(c!.contrato.ronda)},{label:'Asignación formal',value:c!.correccion.fechaAsignada ?? 'Pendiente de formalización'});
    const [q]=await db.select({q:informacionContrato,actor:users.nombre}).from(informacionContrato).leftJoin(users,eq(users.id,informacionContrato.askedById)).where(eq(informacionContrato.contratoId,id)).orderBy(desc(informacionContrato.askedAt),desc(informacionContrato.id)).limit(1);
    if(q)pregunta={id:q.q.id,texto:q.q.pregunta,actor:q.actor ?? 'Talento Humano',fecha:q.q.askedAt.toISOString(),respuesta:q.q.respuesta,respondidaEn:q.q.answeredAt?.toISOString() ?? null};
  } else if(r.tipo==='creativa') {
    const [c]=await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.workItemId,r.work_item_id));
    contexto.push({label:'Título definitivo',value:r.titulo_actual},{label:'Subtítulo definitivo',value:r.subtitulo_definitivo ?? 'Sin registro'},{label:'Reunión',value:c?.fechaReunion ?? 'Sin fecha registrada'});
    if(c?.enlaceGrabacion)enlaces.push({label:'Grabación de reunión',url:c.enlaceGrabacion});
    if(c?.briefEnlace)enlaces.push({label:'Brief creativo',url:c.briefEnlace});
    eventTypes=['DIRECCION_CREATIVA_SOLICITADA','LIDER_CREATIVO_ASIGNADO','REUNION_CREATIVA_REGISTRADA'];
  } else if(r.tipo==='calidad') {
    const [q]=await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.workItemId,id));
    contexto.push({label:'Fase / ronda',value:`F${q?.numeroFase} · ronda ${q?.ronda}`},{label:'Versión',value:q?.pdfVersion ?? 'Sin etiqueta'},{label:'Comentarios',value:q?.cantidadComentarios?.toString() ?? 'Sin revisión registrada'});
    if(q?.pdfUrl)enlaces.push({label:'Versión enviada a Calidad',url:q.pdfUrl});
    if(q?.comentariosUrl)enlaces.push({label:'PDF con comentarios',url:q.comentariosUrl});
    eventTypes=['DISENO_HANDOFF_CALIDAD','CALIDAD_INICIADA','CALIDAD_REVISADA','CALIDAD_REVISION_FINAL_SOLICITADA'];
  } else if(r.tipo==='editor') {
    const assignments=await pool.query<{id:string}>(`SELECT id FROM project_assignments WHERE proyecto_id=$1 AND tipo='editor' AND work_item_id IS NULL AND asignado_en>=$2 ORDER BY asignado_en,id LIMIT 1`,[r.proyecto_id,r.requested_at]);
    relatedIds.push(...assignments.rows.map(a=>a.id));eventTypes=['EDITOR_SOLICITADO','EDITOR_ASIGNADO','EDITOR_REASIGNADO'];
    contexto.push({label:'Resultado',value:r.outcome ?? 'Jefatura de Edición debe asignar Editor'});
  } else {eventTypes=r.tipo==='digital'?['AMAZON_ACTIVACION_HABILITADA','AMAZON_ACTIVACION_REGISTRADA']:['PLANIFICACION_RRPP_CREADA','PLANIFICACION_RRPP_ACTUALIZADA'];}
  const events=await db.select({id:auditLogs.id,accion:auditLogs.accion,detalles:auditLogs.detalles,fecha:auditLogs.createdAt,actor:users.nombre}).from(auditLogs).leftJoin(users,eq(users.id,auditLogs.actorId)).where(and(eq(auditLogs.proyectoId,r.proyecto_id),r.tipo==='contrato'?eq(auditLogs.entityId,id):inArray(auditLogs.accion,eventTypes),r.tipo==='contrato'?undefined:r.tipo==='digital'?undefined:inArray(auditLogs.entityId,relatedIds))).orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(50);
  return {...result,version,contexto,enlaces:enlaces.filter(e=>/^https?:\/\//i.test(e.url)),pregunta,historial:events.reverse().map(e=>({id:e.id,texto:EVENTOS_CONTRATO[e.accion] ?? etiquetaEventoFicha(e.accion,e.detalles),actor:e.actor ?? 'Sistema',fecha:e.fecha.toISOString()}))};
}
