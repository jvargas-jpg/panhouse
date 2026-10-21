import {useState} from 'react';
import {Link} from 'react-router-dom';
import {NAV_ACTIVO,NAV_INACTIVO} from '../layout/CrmSidebarLayout';
import {RrppIcon} from '../rrpp/RrppIcons';
const items=[{id:'inicio',label:'Inicio',icon:'inicio'},{id:'mi-trabajo',label:'Mi trabajo',icon:'proceso'},
  {id:'proyectos-creativos',label:'Proyectos creativos',icon:'proyectos'},{id:'solicitudes',label:'Solicitudes',icon:'ingreso'},
  {id:'indicadores',label:'Indicadores',icon:'indicadores'}] as const;
export function CreativeSidebarNav({active,actions=0,requests=0,mobile=false}:{active:string;actions?:number;requests?:number;mobile?:boolean}){
  const [open,setOpen]=useState(false);
  const nav=<nav className="cl-nav" aria-label="Navegación del Líder Creativo">{items.map(i=><Link key={i.id} to={i.id==='inicio'?'/':'/?vista='+i.id} aria-current={active===i.id?'page':undefined}
    className={active===i.id?NAV_ACTIVO:NAV_INACTIVO} onClick={()=>setOpen(false)}><RrppIcon nombre={i.icon} className="h-5 w-5"/><span>{i.label}</span>{(i.id==='mi-trabajo'?actions:i.id==='solicitudes'?requests:0)>0&&<small>{i.id==='mi-trabajo'?actions:requests}</small>}</Link>)}</nav>;
  return mobile?<div className="cl-mobile-nav"><button aria-expanded={open} aria-controls="cl-mobile-menu" onClick={()=>setOpen(!open)}><span aria-hidden="true">☰</span> Dirección Creativa</button>{open&&<div id="cl-mobile-menu">{nav}</div>}</div>:nav;
}
