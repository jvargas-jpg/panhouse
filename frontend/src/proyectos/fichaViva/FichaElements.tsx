import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ActividadFicha, CampoFicha, EquipoFicha } from '../../../../shared/fichaViva';
import { StatusBadge } from '../../design-system/components';
import { RrppIcon } from '../../rrpp/RrppIcons';

export function IconFicha({name='document',className=''}:{name?:string;className?:string}){
  const icons:Record<string,Parameters<typeof RrppIcon>[0]['nombre']>={document:'ingreso',book:'libro',people:'equipo',clock:'actividad',arrow:'flecha',grid:'capas'};
  return <RrppIcon nombre={icons[name]??'ingreso'} className={`h-[19px] w-[19px] ${className}`}/>;
}
export function Estado({state}:{state:string}){
  const label:Record<string,string>={en_proceso:'En proceso',completado:'Completado',stand_by:'Stand by',en_progreso:'En curso',pendiente:'Pendiente',bloqueado:'Bloqueado',cancelado:'Cancelado'};
  return <StatusBadge>{label[state]??state}</StatusBadge>;
}
export function Card({title,icon='document',action,children,className=''}:{title:string;icon?:string;action?:ReactNode;children:ReactNode;className?:string}){
  return <section className={'fv-card '+className}><div className="fv-card-head"><h2><IconFicha name={icon}/>{title}</h2>{action}</div>{children}</section>;
}
export function dateFicha(value:string|null|undefined,withTime=false){
  if(!value)return 'Sin registrar';
  const date=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T12:00:00'):new Date(value);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('es-VE',{day:'numeric',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(date);
}
export function FieldValue({field}:{field:CampoFicha}){
  const value=field.value;
  if(value===null||value===undefined||value===''||(Array.isArray(value)&&!value.length))return <span className="fv-empty-value">Sin registrar</span>;
  if(typeof value==='boolean')return <span>{value?'Sí':'No'}</span>;
  if(Array.isArray(value))return <span>{value.filter(v=>typeof v!=='object').join(' · ')||'Sin registrar'}</span>;
  if(typeof value==='string'){
    if(/^https?:\/\//i.test(value)){try{const u=new URL(value);if(u.username||u.password)return <span>Documento protegido</span>;return <a className="fv-doc-link" href={value} target="_blank" rel="noopener noreferrer">Abrir <span aria-hidden="true">↗</span><span className="sr-only">{field.label}</span></a>;}catch{return <span>Enlace no válido</span>;}}
    if(/^\d{4}-\d{2}-\d{2}(T|$)/.test(value))return <span>{dateFicha(value,value.includes('T'))}</span>;
    const labels:Record<string,string>={en_proceso:'En proceso',en_progreso:'En curso',pendiente:'Pendiente',completado:'Completado',bloqueado:'Bloqueado',cancelado:'Cancelado'};
    return <span>{labels[value]??value}</span>;
  }
  return <span>{typeof value==='number'?value:'Consultar en el área responsable'}</span>;
}
export function ReadFields({fields,onEdit}:{fields:CampoFicha[];onEdit?:(field:CampoFicha)=>void}){
  return <dl className="fv-fields">{fields.map(field=><div className="fv-field" key={field.key}><dt>{field.label}{field.legacy&&<small>Histórico</small>}</dt><dd><FieldValue field={field}/>{field.editable&&onEdit&&<button className="fv-field-edit" onClick={()=>onEdit(field)} aria-label={'Editar '+field.label}>Editar</button>}</dd></div>)}</dl>;
}
export function Equipo({items,history=false}:{items:EquipoFicha[];history?:boolean}){
  if(!items.length)return <p className="fv-empty">Todavía no hay {history?'asignaciones anteriores':'responsables asignados'}.</p>;
  return <ul className="fv-team">{items.map(item=><li key={item.id}><span className="fv-avatar" aria-hidden="true">{item.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</span><div><strong>{item.name}</strong><span>{item.role} · {item.scope}</span>{history&&<small>{dateFicha(item.assignedAt)} → {item.endedAt?dateFicha(item.endedAt):'Vigente'}</small>}</div></li>)}</ul>;
}
export function Actividad({items}:{items:ActividadFicha[]}){
  if(!items.length)return <p className="fv-empty">Los próximos avances del proyecto aparecerán aquí.</p>;
  return <ol className="fv-activity">{items.map(item=><li key={item.id}><span className="fv-timeline-dot" aria-hidden="true"/><div><strong>{item.label}</strong><span>{item.actor} · {item.area}</span></div><time dateTime={item.date}>{dateFicha(item.date)}</time></li>)}</ol>;
}
export function WorkspaceLink({href,children}:{href:string;children:ReactNode}){return <Link className="fv-workspace-link" to={href}>{children}<IconFicha name="arrow"/></Link>;}
export function FichaSkeleton(){return <div className="fv-skeleton" role="status" aria-label="Cargando ficha"><div className="fv-skeleton-header"/><div className="fv-skeleton-states">{[1,2,3,4].map(x=><div key={x}/>)}</div><div className="fv-skeleton-body"><div/><div/></div></div>;}
