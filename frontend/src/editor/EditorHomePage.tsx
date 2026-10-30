import '../jefeEdicion/editorialChief.css';
import './editor.css';
import { useSearchParams } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';

import { RrppIcon } from '../rrpp/RrppIcons';

import { EDITOR_NAV, EditorNav } from './EditorParts';
import { EditorInicio } from './EditorInicio';
import { EditorMiTrabajo } from './EditorMiTrabajo';
import { EditorMisProyectos } from './EditorMisProyectos';
import { EditorMisSolicitudes } from './EditorMisSolicitudes';

const DESCRIPTIONS: Record<string,string>={
 inicio:'Tu panorama editorial de hoy. Aquí encontrarás tus pendientes, próximas entregas y novedades de tus proyectos.',
 'mi-trabajo':'Gestiona tus intervenciones asignadas, registra avances, entregas y bloqueos.',
 'mis-proyectos':'Consulta los proyectos en los que participas, su estado y tu historial de intervención.',
 'mis-solicitudes':'Consulta las solicitudes que has enviado y revisa su estado, respuesta y resultado.'
};
export function EditorHomePage(){
 const [params]=useSearchParams();
 const active=EDITOR_NAV.find(n=>n[0]===params.get('vista'))?.[0]??'inicio';
 const title=EDITOR_NAV.find(n=>n[0]===active)![1];
 const today=new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
 return <CrmSidebarLayout nav={<EditorNav active={active}/>}    contentMaxWidth="max-w-none" shellClassName="editor-layout" contentClassName="ec-shell editor-shell"
 >


  <div className="ec-body"><nav className="eo-breadcrumb" aria-label="Ruta de navegación"><span>Editor</span><RrppIcon nombre="flecha"/><strong>{title}</strong></nav>
   <header className="ec-page-header"><div><h1>{title}</h1><p>{DESCRIPTIONS[active]}</p></div><div className="eo-dateline"><time>{today}</time></div></header>
   {active==='mi-trabajo'?<EditorMiTrabajo/>:active==='mis-proyectos'?<EditorMisProyectos/>:active==='mis-solicitudes'?<EditorMisSolicitudes/>:<EditorInicio/>}
  </div>
 </CrmSidebarLayout>;
}
