import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import type { EditorialIntervention } from '../../../shared/editorialChief';
export type EditorIcon = Parameters<typeof RrppIcon>[0]['nombre'];

export function useEditorFilters() {
  const [params,setParams]=useSearchParams();
  const update=(key:string|Record<string,string>,value='')=>setParams(current=>{const p=new URLSearchParams(current);const entries=typeof key==='string'?[[key,value]]:Object.entries(key);for(const [k,v] of entries)v?p.set(k,v):p.delete(k);if(entries.some(([k])=>!['workItem','project','request','detailTab','view','action','detailClosed'].includes(k)))p.delete('page');return p;});
  const urlSearch=params.get('search')??'';
  const [search,setSearch]=useState(urlSearch);
  useEffect(()=>setSearch(urlSearch),[urlSearch]);
  useEffect(()=>{if(search===urlSearch)return;const timer=setTimeout(()=>update('search',search),300);return()=>clearTimeout(timer);},[search,urlSearch]);
  return {params,setParams,update,search,setSearch};
}

export function EditorKpis({items}:{items:{label:string;value:number|string;sub:string;icon:EditorIcon;color:string;href?:string;onClick?:()=>void}[]}) {
  return <div className="ec-kpis eo-kpis">{items.map(k=>{
    const content=<><span className="ec-kpi-icon"><RrppIcon nombre={k.icon}/></span><span className="eo-kpi-copy"><strong>{k.value}</strong><b>{k.label}</b><small>{k.sub}</small></span>{(k.href||k.onClick)&&<RrppIcon nombre="flecha" className="eo-kpi-arrow"/>}</>;
    return k.href?<Link key={k.label} className={'ec-kpi ec-'+k.color} to={k.href}>{content}</Link>:<button key={k.label} type="button" className={'ec-kpi ec-'+k.color} onClick={k.onClick} disabled={!k.onClick}>{content}</button>;
  })}</div>;
}

export function EditorSearch({value,onChange,placeholder}:{value:string;onChange:(s:string)=>void;placeholder:string}) {
  return <label className="eo-search"><span className="sr-only">{placeholder}</span><RrppIcon nombre="buscar"/><input type="search" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>;
}
export function EditorSelect({label,value,onChange,options}:{label:string;value:string;onChange:(s:string)=>void;options:{id:string;name:string}[]}) {
  return <label className="eo-select"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="">{label}</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
}
export function EditorPagination({data,onPage}:{data:{total:number;pages:number;page:number};onPage:(p:number)=>void}) {
  return <footer className="eo-pagination"><span>{data.total} resultado{data.total!==1?'s':''}</span><div><button aria-label="Página anterior" disabled={data.page<=1} onClick={()=>onPage(data.page-1)}>‹</button><span>{data.page} / {data.pages}</span><button aria-label="Página siguiente" disabled={data.page>=data.pages} onClick={()=>onPage(data.page+1)}>›</button></div></footer>;
}
export function EditorSkeleton({label='Cargando información'}:{label?:string}) {
  return <div className="eo-skeleton" role="status" aria-label={label}><i/><i/><i/><i/></div>;
}

export function EditorDetail({title,open,onClose,children,modal=false}:{title:string;open:boolean;onClose:()=>void;children:ReactNode;modal?:boolean}) {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    const mobile=window.matchMedia('(max-width:1199px)').matches;
    const overflow=document.body.style.overflow;
    if(modal)document.body.style.overflow='hidden';
    if(mobile)ref.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape')onClose();
      if(e.key!=='Tab'||!mobile)return;
      const controls=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);if(modal)document.body.style.overflow=overflow;if(mobile)previous?.focus();};
  },[open,modal]);
  return <><button className={'eo-detail-backdrop'+(open?' is-open':'')} aria-label="Cerrar detalle" tabIndex={-1} onClick={onClose}/><aside ref={ref} tabIndex={-1} role={modal&&open?'dialog':undefined} aria-modal={modal&&open?true:undefined} className={'eo-detail'+(open?' is-open':'')} aria-label={title}><header className="eo-detail-title"><RrppIcon nombre="ingreso"/><h2>{title}</h2><button aria-label="Cerrar detalle" onClick={onClose}>×</button></header>{children}</aside></>;
}

export function EditorStatus({state}:{state:string}) {
  const color=/Bloque|Vencid|Devuelta/.test(state)?'red':/autor|Especialista|pausa|Pendiente|Por iniciar/.test(state)?'amber':/Complet|Resuelta/.test(state)?'green':/ajustes/.test(state)?'violet':'blue';
  return <span className={'ec-status ec-'+color}><i/>{state}</span>;
}
export const currentOwner=(i:EditorialIntervention)=>i.waitingOn==='author'?'Autor':i.waitingOn==='specialist'?'Especialista':i.waitingOn==='project_pause'?'Proyecto en pausa':i.state==='Completadas'?'Finalizado':'Tú';

export function activityVisual(text:string):{icon:EditorIcon;color:string} {
  if(/Bloqueo resuelto/.test(text))return{icon:'check',color:'green'};
  if(/[Bb]loqueo/.test(text))return{icon:'riesgo',color:'red'};
  if(/[Ee]ntreg|aplicado/.test(text))return{icon:'check',color:'green'};
  if(/[Ff]eedback/.test(text))return{icon:'comentarios',color:'violet'};
  if(/asignad/.test(text))return{icon:'equipo',color:'amber'};
  if(/[Ss]olicitu/.test(text))return{icon:'ingreso',color:'blue'};
  return{icon:'actividad',color:'blue'};
}
export const interventionType=(i:EditorialIntervention)=>i.interventionType==='feedback'?'Aplicación de feedback':i.chapter?'Edición de capítulo':i.label;
export const workAction=(i:EditorialIntervention)=>i.state==='Bloqueadas'?'Ver bloqueo':i.state==='Requiere ajustes'?'Aplicar feedback':i.state==='Completadas'?'Ver entrega':i.waitingOn?'Ver contexto':'Abrir';

export function useEditorDesktop(){
 const [desktop,setDesktop]=useState(()=>typeof window==='undefined'||window.matchMedia('(min-width:1200px)').matches);
 useEffect(()=>{const media=window.matchMedia('(min-width:1200px)');const sync=()=>setDesktop(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 return desktop;
}
