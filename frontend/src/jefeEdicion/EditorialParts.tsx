import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import type { EditorialDashboard, EditorialIntervention, EditorialState } from '../../../shared/editorialChief';
export const EDITORIAL_NAV=[['inicio','Inicio','inicio'],['asignaciones','Asignaciones y carga','equipo'],['proyectos-edicion','Proyectos de edición','proyectos'],['seguimiento-edicion','Seguimiento','proceso'],['solicitudes-edicion','Solicitudes','ingreso'],['indicadores-edicion','Indicadores','indicadores']] as const;
export const editorialDate=(value:string|null,full=false)=>value?new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',day:'numeric',month:full?'long':'short',...(full?{year:'numeric' as const}:{})}).format(new Date(value.length===10?value+'T12:00:00Z':value)):'Sin fecha';
export function EditorialNav({active,pending=0,mobile=false}:{active:string;pending?:number;mobile?:boolean}){
  const [open,setOpen]=useState(false);
  const nav=<nav aria-label="Navegación de Edición" className="ec-nav">{EDITORIAL_NAV.map(([id,label,icon])=><Link key={id} to={id==='inicio'?'/':'/?vista='+id} aria-current={active===id?'page':undefined} onClick={()=>setOpen(false)}><RrppIcon nombre={icon}/><span>{label}</span>{id==='solicitudes-edicion'&&pending>0&&<small>{pending}</small>}</Link>)}</nav>;
  return mobile?<div className="ec-mobile-nav"><button aria-expanded={open} aria-controls="ec-mobile-menu" onClick={()=>setOpen(!open)}>☰ <span>Área de Edición</span></button>{open&&<div id="ec-mobile-menu">{nav}</div>}</div>:nav;
}
export function EditorialPanel({title,icon,action,children,className=''}:{title:string;icon?:Parameters<typeof RrppIcon>[0]['nombre'];action?:ReactNode;children:ReactNode;className?:string}){
  return <section className={'ec-panel '+className}><header>{icon&&<RrppIcon nombre={icon}/>}<h2>{title}</h2>{action}</header>{children}</section>;
}
export function EditorialEmpty({children}:{children:ReactNode}){return <p className="ec-empty">{children}</p>;}
export function EditorialCover({url}:{url?:string|null}){const [failed,setFailed]=useState(false);return url&&/^https:\/\//i.test(url)&&!failed?<img className="ec-cover" src={url} alt="Portada del proyecto" onError={()=>setFailed(true)}/>:<span className="ec-cover" aria-label="Sin portada registrada"><RrppIcon nombre="libro"/></span>;}
export function EditorialRows({items,onOpen}:{items:EditorialIntervention[];onOpen:(id:string)=>void}){
  return items.length?<div className="ec-table-wrap"><table className="ec-table"><thead><tr>{['Proyecto / Autor','Intervención','Servicio','Situación','Editor actual','Fecha límite','Acción'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{items.map(i=><tr key={i.id}>
    <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover/><span><strong>{i.title}</strong><small>{i.authors}</small></span></div></td><td data-label="Intervención">{i.label}</td><td data-label="Servicio"><span className="ec-service">{i.service}</span></td>
    <td data-label="Situación"><span className={'ec-status '+(i.overdue?'ec-red':i.needsAssignment||i.atRisk?'ec-amber':'ec-blue')}>{i.situation??i.state}</span></td><td data-label="Editor actual">{i.editor??'Por asignar'}</td><td data-label="Fecha límite" className={i.overdue?'ec-deadline-overdue':''}>{editorialDate(i.dueDate)}</td><td data-label="Acción"><button className="ec-primary" onClick={()=>onOpen(i.id)}>{i.cta}</button></td>
  </tr>)}</tbody></table></div>:<EditorialEmpty>No hay situaciones que requieran tu atención.</EditorialEmpty>;
}
const COLORS:Record<EditorialState,string>={'En edición':'#76a8f3','Esperando autor':'#efc75e','Esperando Especialista':'#a2b9d6','En pausa':'#b7bec8','Requiere ajustes':'#fa9386','Pendiente':'#cbb8ed','Completadas':'#9cd8af','Bloqueadas':'#cc7180'};
export function EditorialDistribution({data}:{data:EditorialDashboard['interventionDistribution']}){
  const total=data.reduce((n,d)=>n+d.count,0);let start=0;
  const gradient=data.map(d=>{const from=start;start+=d.count/total*100;return `${COLORS[d.state]} ${from}% ${start}%`;}).join(',');
  return total?<div className="ec-distribution"><div className="ec-donut" role="img" aria-label={data.map(d=>d.state+': '+d.count).join(', ')} style={{background:`conic-gradient(${gradient})`}}><span><strong>{total}</strong><small>Intervenciones<br/>en total</small></span></div><ul>{data.map(d=><li key={d.state}><i style={{background:COLORS[d.state]}}/><span>{d.state}</span><b>{d.count}</b></li>)}</ul></div>:<EditorialEmpty>No hay intervenciones de Edición registradas.</EditorialEmpty>;
}
export function EditorialKpis({data}:{data:EditorialDashboard}){
  const cards=[{label:'Por asignar',value:data.summary.unassigned,sub:'Solicitudes listas para asignar',icon:'ingreso',filter:'unassigned',view:'asignaciones',color:'amber'},
    {label:'Entregas vencidas',value:data.summary.overdue,sub:'Bajo responsabilidad de Edición',icon:'actividad',filter:'overdue',view:'seguimiento-edicion',color:'red'},
    {label:'En riesgo',value:data.summary.atRisk,sub:'Entregas que vencen hoy',icon:'riesgo',filter:'risk',view:'seguimiento-edicion',color:'amber'},
    {label:'Solicitudes pendientes',value:data.summary.pendingRequests,sub:'Requieren tu decisión',icon:'ingreso',filter:'unassigned',view:'solicitudes-edicion',color:'blue'}] as const;
  return <div className="ec-kpis">{cards.map(c=><Link className={'ec-kpi ec-'+c.color} key={c.label} to={`/?vista=${c.view}&filter=${c.filter}`}><span className="ec-kpi-icon"><RrppIcon nombre={c.icon}/></span><span><strong>{c.value}</strong><b>{c.label}</b><small>{c.sub}</small></span></Link>)}</div>;
}
export function EditorialTeam({data,onLoad,all=false}:{data:EditorialDashboard;onLoad:(id:string)=>void;all?:boolean}){
 return data.editorLoads.length?<><div className="ec-load-head"><span>Editor</span><span>Activas</span><span>Vencen esta semana</span><span>Vencidas</span></div>{data.editorLoads.slice(0,all?undefined:4).map((e,n)=><button className="ec-load-row" key={e.id} onClick={()=>onLoad(e.id)}><span><i className={'ec-avatar ec-avatar-'+n%4}>{e.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('')}</i><b>{e.name}</b></span><strong>{e.active}</strong><strong>{e.upcoming}</strong><strong className={e.overdue?'ec-deadline-overdue':''}>{e.overdue}</strong></button>)}</>:<EditorialEmpty>No hay Editores disponibles en el equipo.</EditorialEmpty>;
}
