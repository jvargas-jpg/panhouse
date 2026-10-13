import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCapitulos, solicitarEditor } from './proyectoDetalleApi';
import { apiFetch } from '../lib/api';
import type { Capitulo } from '../types/api';
import { dateFicha } from './fichaViva/FichaElements';
import { Link, useSearchParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import type { SolicitudesEspecialista } from '../../../shared/especialistaSolicitudes';

function CapituloAutor({ id, capitulo, canEdit }: { id: string; capitulo: Capitulo; canEdit: boolean }) {
  const [params]=useSearchParams();
  useEffect(()=>{if(params.get('capitulo')===String(capitulo.numero))document.getElementById('cc-capitulo-'+capitulo.numero)?.scrollIntoView({block:'center'});},[params,capitulo.numero]);
  const [envio, setEnvio] = useState(capitulo.fechaEnvioAutor ?? ''), [respuesta, setRespuesta] = useState(capitulo.fechaRespuestaReal ?? '');
  const cache = useQueryClient();
  const mutation = useMutation({ mutationFn: () => apiFetch('/capitulos/'+id+'/'+capitulo.numero+'/autor', { method: 'PATCH', body: JSON.stringify({ fechaEnvioAutor: envio || null, fechaRespuestaReal: respuesta || null }) }), onSuccess: () => { cache.invalidateQueries({ queryKey: ['capitulos', id] }); cache.invalidateQueries({ queryKey: ['proyecto', id] });cache.invalidateQueries({queryKey:['mi-trabajo']});cache.invalidateQueries({queryKey:['especialista-inicio']}); } });
  return <article id={'cc-capitulo-'+capitulo.numero} className="cc-chapter" style={params.get('capitulo')===String(capitulo.numero)?{borderColor:'#b68b32'}:undefined}><h3>Capítulo {capitulo.numero}</h3><p className="cc-caption">Entrega de Edición: {dateFicha(capitulo.fechaEntregaEditor)} · Feedback pautado: {dateFicha(capitulo.fechaPautadaFeedback)}</p>{canEdit ? <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="cc-chapter-form"><label>Enviado al autor<input aria-label={'Envío al autor · capítulo '+capitulo.numero} type="date" value={envio} onChange={e => setEnvio(e.target.value)}/></label><label>Respuesta recibida<input aria-label={'Respuesta del autor · capítulo '+capitulo.numero} type="date" value={respuesta} onChange={e => setRespuesta(e.target.value)}/></label><button className="fv-button" disabled={mutation.isPending}>Guardar feedback</button>{mutation.isError && <p role="alert">{mutation.error.message}</p>}</form> : <p>Enviado al autor: {dateFicha(capitulo.fechaEnvioAutor)} · Respuesta: {dateFicha(capitulo.fechaRespuestaReal)}</p>}</article>;
}
export function CommandCenterEdicion({ id, canEdit, editorId }: { id: string; canEdit: boolean; editorId: string | null }) {
  const {data:user}=useMe();
  const requests=useQuery({queryKey:['solicitudes',user?.id,'edicion',id],queryFn:()=>apiFetch<SolicitudesEspecialista>('/especialistas/solicitudes?tipo=editor&tab=todas&proyecto='+id),enabled:canEdit});
  const requested=requests.data?.solicitudes.find(s=>s.tipo==='editor'&&s.estado==='pendiente');
  const query = useQuery({ queryKey: ['capitulos', id], queryFn: () => fetchCapitulos(id) }), cache = useQueryClient();
  const mutation = useMutation({ mutationFn: () => solicitarEditor(id), onSuccess: () => {cache.invalidateQueries({ queryKey: ['proyecto', id] });cache.invalidateQueries({queryKey:['solicitudes']});cache.invalidateQueries({queryKey:['mi-trabajo']});} });
  return <section className="cc-chapters"><h2>Edición y feedback del autor</h2>{!editorId && canEdit && <div className="cc-chapter"><p className="cc-caption">La asignación corresponde a Jefatura de Edición.</p><button className="fv-button fv-primary" disabled={mutation.isPending || mutation.isSuccess || !!requested || requests.isPending || requests.isError} onClick={() => mutation.mutate()}>{mutation.isSuccess || requested ? 'Editor solicitado' : 'Solicitar Editor'}</button>{requested&&<Link className="ml-3 text-sm underline" to={'/?'+new URLSearchParams({vista:'solicitudes',request:requested.id})}>Ver solicitud</Link>}{requests.isError&&<p role="alert">No se pudo comprobar la solicitud. <button onClick={()=>requests.refetch()}>Reintentar</button></p>}{mutation.isError && <p role="alert">{mutation.error.message}</p>}</div>}{query.isPending ? <p role="status">Consultando capítulos…</p> : query.isError ? <p role="alert">{query.error.message} <button onClick={() => query.refetch()}>Reintentar</button></p> : query.data.capitulos.length ? query.data.capitulos.map(c => <CapituloAutor key={c.id} id={id} capitulo={c} canEdit={canEdit}/>) : <p className="cc-caption">Edición aún no ha registrado capítulos.</p>}</section>;
}
