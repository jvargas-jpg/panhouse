import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCapitulos, solicitarEditor } from './proyectoDetalleApi';
import { apiFetch } from '../lib/api';
import type { Capitulo } from '../types/api';
import { dateFicha } from './fichaViva/FichaElements';

function CapituloAutor({ id, capitulo, canEdit }: { id: string; capitulo: Capitulo; canEdit: boolean }) {
  const [envio, setEnvio] = useState(capitulo.fechaEnvioAutor ?? ''), [respuesta, setRespuesta] = useState(capitulo.fechaRespuestaReal ?? '');
  const cache = useQueryClient();
  const mutation = useMutation({ mutationFn: () => apiFetch('/capitulos/'+id+'/'+capitulo.numero+'/autor', { method: 'PATCH', body: JSON.stringify({ fechaEnvioAutor: envio || null, fechaRespuestaReal: respuesta || null }) }), onSuccess: () => { cache.invalidateQueries({ queryKey: ['capitulos', id] }); cache.invalidateQueries({ queryKey: ['proyecto', id] }); } });
  return <article className="cc-chapter"><h3>Capítulo {capitulo.numero}</h3><p className="cc-caption">Entrega de Edición: {dateFicha(capitulo.fechaEntregaEditor)} · Feedback pautado: {dateFicha(capitulo.fechaPautadaFeedback)}</p>{canEdit ? <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="cc-chapter-form"><label>Enviado al autor<input aria-label={'Envío al autor · capítulo '+capitulo.numero} type="date" value={envio} onChange={e => setEnvio(e.target.value)}/></label><label>Respuesta recibida<input aria-label={'Respuesta del autor · capítulo '+capitulo.numero} type="date" value={respuesta} onChange={e => setRespuesta(e.target.value)}/></label><button className="fv-button" disabled={mutation.isPending}>Guardar feedback</button>{mutation.isError && <p role="alert">{mutation.error.message}</p>}</form> : <p>Enviado al autor: {dateFicha(capitulo.fechaEnvioAutor)} · Respuesta: {dateFicha(capitulo.fechaRespuestaReal)}</p>}</article>;
}
export function CommandCenterEdicion({ id, canEdit, editorId }: { id: string; canEdit: boolean; editorId: string | null }) {
  const query = useQuery({ queryKey: ['capitulos', id], queryFn: () => fetchCapitulos(id) }), cache = useQueryClient();
  const mutation = useMutation({ mutationFn: () => solicitarEditor(id), onSuccess: () => cache.invalidateQueries({ queryKey: ['proyecto', id] }) });
  return <section className="cc-chapters"><h2>Edición y feedback del autor</h2>{!editorId && canEdit && <div className="cc-chapter"><p className="cc-caption">La asignación corresponde a Jefatura de Edición.</p><button className="fv-button fv-primary" disabled={mutation.isPending || mutation.isSuccess} onClick={() => mutation.mutate()}>{mutation.isSuccess ? 'Editor solicitado' : 'Solicitar Editor'}</button>{mutation.isError && <p role="alert">{mutation.error.message}</p>}</div>}{query.isPending ? <p role="status">Consultando capítulos…</p> : query.isError ? <p role="alert">{query.error.message} <button onClick={() => query.refetch()}>Reintentar</button></p> : query.data.capitulos.length ? query.data.capitulos.map(c => <CapituloAutor key={c.id} id={id} capitulo={c} canEdit={canEdit}/>) : <p className="cc-caption">Edición aún no ha registrado capítulos.</p>}</section>;
}
