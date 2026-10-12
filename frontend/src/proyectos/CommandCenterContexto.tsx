import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ProjectCommandCenter } from '../../../shared/projectCommandCenter';

export function CommandCenterContexto({ id, data, abierto = false }: { id: string; data: ProjectCommandCenter; abierto?: boolean }) {
  const [titulo,setTitulo]=useState(data.datosEditoriales.titulo??''), [subtitulo,setSubtitulo]=useState(data.datosEditoriales.subtitulo??'');
  const [estado,setEstado]=useState(data.ficha.project.macroState);
  const titleMutation=useMutation({mutationFn:()=>apiFetch('/proyectos/'+id+'/datos-editoriales',{method:'PATCH',body:JSON.stringify({titulo:titulo.trim()||null,subtitulo:subtitulo.trim()||null})})});
  const stateMutation=useMutation({mutationFn:()=>apiFetch('/proyectos/'+id,{method:'PATCH',body:JSON.stringify({estado})})});
  return <details open={abierto || undefined} className="cc-context-edit"><summary>Gestionar contexto editorial</summary><div className="cc-context-forms"><form onSubmit={e=>{e.preventDefault();titleMutation.mutate();}}><label>Título definitivo<input maxLength={300} value={titulo} onChange={e=>setTitulo(e.target.value)}/></label><label>Subtítulo definitivo<input maxLength={300} value={subtitulo} onChange={e=>setSubtitulo(e.target.value)}/></label><button className="fv-button" disabled={titleMutation.isPending}>Guardar títulos</button>{titleMutation.isError&&<p role="alert">{titleMutation.error.message}</p>}{titleMutation.isSuccess&&<p role="status">Títulos registrados.</p>}</form><form onSubmit={e=>{e.preventDefault();stateMutation.mutate();}}><label>Estado del proyecto<select value={estado} onChange={e=>setEstado(e.target.value)}>{Object.entries({en_proceso:'En proceso',retrasado:'Retrasado',stand_by:'Stand-by',culminado:'Culminado',retirado:'Retirado',...(estado==='pausado'?{pausado:'Pausado (registro formal)'}:{})}).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p className="cc-caption">Las pausas formales se registran en su flujo autorizado.</p><button className="fv-button" disabled={stateMutation.isPending||estado===data.ficha.project.macroState}>Registrar estado</button>{stateMutation.isError&&<p role="alert">{stateMutation.error.message}</p>}</form></div></details>;
}
