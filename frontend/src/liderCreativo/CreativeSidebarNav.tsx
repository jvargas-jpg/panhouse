
import {Link} from 'react-router-dom';

import {RrppIcon} from '../rrpp/RrppIcons';
const items=[{id:'inicio',label:'Inicio',icon:'inicio'},{id:'mi-trabajo',label:'Mi trabajo',icon:'proceso'},
  {id:'proyectos-creativos',label:'Proyectos creativos',icon:'proyectos'},{id:'solicitudes',label:'Solicitudes',icon:'ingreso'},
  {id:'indicadores',label:'Indicadores',icon:'indicadores'}] as const;
export function CreativeSidebarNav({active,actions=0,requests=0}:{active:string;actions?:number;requests?:number}){return <nav aria-label="Navegación del Líder Creativo">{items.map(i=><Link key={i.id} to={i.id==='inicio'?'/':'/?vista='+i.id} aria-current={active===i.id?'page':undefined}><RrppIcon nombre={i.icon}/><span>{i.label}</span>{(i.id==='mi-trabajo'?actions:i.id==='solicitudes'?requests:0)>0&&<small>{i.id==='mi-trabajo'?actions:requests}</small>}</Link>)}</nav>;}
